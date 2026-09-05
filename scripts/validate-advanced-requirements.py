"""Read-only CSV validation for the research v2 candidate pack (Python 3 stdlib).

This does not approve labels, create training splits, or change the v1 dataset.
"""
import argparse
import csv
import json
import math
from collections import Counter
from datetime import date, datetime
from pathlib import Path

SENTENCE_COLUMNS = "sentence_id raw_sentence category input_channel speaker visibility planning_mode sentence_type primary_attribute preference_or_avoid degree evidence_summary needs_follow_up follow_up_question paraphrase_group research_basis_ids synthetic_source human_reviewer review_status eligible_as_real_evidence risk_tags notes".split()
ANNOTATION_COLUMNS = "annotation_id sentence_id preference_owner attribute schema_class schema_status label_kind direction operator target_min target_max importance confidence hard_no value_text value_number unit normalized_date reference_datetime scope source visibility evidence_span needs_follow_up expected_delta privacy_safe_dimension shared_explanation_allowed human_reviewer review_status notes".split()
APPROVED = {"核准", "已核准", "approved"}
REVIEW_STATES = APPROVED | {"待審", "有爭議", "退回", "pending", "disputed", "rejected"}


def read_csv(path, columns):
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source, strict=True)
        if reader.fieldnames != columns:
            raise ValueError(f"{path.name}: unexpected columns or column order")
        rows = list(reader)
    if not rows or any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f"{path.name}: empty data or malformed row width")
    return rows


def fully_approved(rows):
    return bool(rows) and all(row["review_status"] in APPROVED and row["human_reviewer"].strip() for row in rows)


def validate(sentences, annotations):
    errors = []

    def check(condition, location, problem):
        if not condition:
            errors.append(f"{location}: {problem}")

    for rows, key in [(sentences, "sentence_id"), (annotations, "annotation_id")]:
        for value, count in Counter(row[key] for row in rows).items():
            check(bool(value) and count == 1, key, "missing or duplicate ID")
        for row in rows:
            check(row["review_status"] in REVIEW_STATES, row[key], "unknown review state")
            check(row["review_status"] not in APPROVED or row["human_reviewer"].strip(), row[key], "approval requires a human reviewer")

    by_id = {row["sentence_id"]: row for row in sentences}
    coverage = Counter(row["sentence_id"] for row in annotations)
    for sentence in sentences:
        sid = sentence["sentence_id"]
        check(bool(sentence["raw_sentence"].strip()) and bool(sentence["paraphrase_group"].strip()), sid, "missing sentence or paraphrase group")
        check(coverage[sid] > 0, sid, "no annotations")
        check(sentence["needs_follow_up"] in {"是", "否"}, sid, "invalid follow-up flag")
        check((sentence["needs_follow_up"] == "是") == bool(sentence["follow_up_question"].strip()), sid, "follow-up flag/question mismatch")
        check(sentence["synthetic_source"] == "research_informed_synthetic_not_copied" and sentence["eligible_as_real_evidence"] == "否", sid, "synthetic provenance must remain explicit")
        # Sentence summaries concatenate spans; only atomic evidence is one exact substring.
        for span in sentence["evidence_summary"].split("｜"):
            check(not span or span in sentence["raw_sentence"], sid, "summary contains a non-source span")

    for annotation in annotations:
        aid = annotation["annotation_id"]
        sentence = by_id.get(annotation["sentence_id"])
        check(sentence is not None, aid, "unknown sentence ID")
        if sentence is None:
            continue
        check(annotation["visibility"] == sentence["visibility"], aid, "visibility mismatch")
        check(annotation["needs_follow_up"] == sentence["needs_follow_up"], aid, "follow-up mismatch")
        if annotation["label_kind"] == "unmentioned":
            check(not annotation["evidence_span"] and annotation["direction"] == "none", aid, "unmentioned must have no evidence/direction")
        else:
            check(bool(annotation["evidence_span"]) and annotation["evidence_span"] in sentence["raw_sentence"], aid, "evidence must be an exact source substring")
        numbers = {}
        for key in ["target_min", "target_max", "importance", "confidence", "value_number"]:
            raw = annotation[key]
            if not raw:
                check(key not in {"importance", "confidence"}, aid, f"missing {key}")
                continue
            try:
                value = float(raw)
                check(math.isfinite(value) and (key == "value_number" or 0 <= value <= 1), aid, f"invalid {key}")
                numbers[key] = value
            except ValueError:
                check(False, aid, f"invalid {key}")
        if "target_min" in numbers and "target_max" in numbers:
            check(numbers["target_min"] <= numbers["target_max"], aid, "reversed target interval")
        try:
            if annotation["normalized_date"]:
                date.fromisoformat(annotation["normalized_date"])
            if annotation["reference_datetime"]:
                value = datetime.fromisoformat(annotation["reference_datetime"])
                check(value.tzinfo is not None, aid, "reference datetime requires timezone")
        except ValueError:
            check(False, aid, "invalid ISO date/datetime")
    return errors


def self_test():
    sentence = dict.fromkeys(SENTENCE_COLUMNS, "")
    sentence.update(sentence_id="T001", raw_sentence="明亮但不要幼稚", paraphrase_group="G1", visibility="private_session", needs_follow_up="否", review_status="待審", synthetic_source="research_informed_synthetic_not_copied", eligible_as_real_evidence="否", evidence_summary="明亮｜不要幼稚")
    annotation = dict.fromkeys(ANNOTATION_COLUMNS, "")
    annotation.update(annotation_id="A001", sentence_id="T001", visibility="private_session", needs_follow_up="否", review_status="待審", label_kind="preference", direction="prefer", evidence_span="明亮", importance="0.5", confidence="0.9")
    assert not validate([sentence], [annotation])
    assert not fully_approved([sentence])
    assert validate([sentence, sentence], [annotation])
    for patch in [{"evidence_span": "不存在"}, {"sentence_id": "missing"}, {"visibility": "shared"}, {"reference_datetime": "2026-09-05T00:00:00"}, {"confidence": "NaN"}, {"review_status": "核准"}]:
        assert validate([sentence], [{**annotation, **patch}])
    print("9 candidate-validator checks passed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path, default=Path(__file__).resolve().parents[1] / ".local" / "phase1")
    parser.add_argument("--require-approved", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    prefix = "sideby_phase1_synthetic_requirements_research_v2"
    sentences = read_csv(args.directory / f"{prefix}_sentences.csv", SENTENCE_COLUMNS)
    annotations = read_csv(args.directory / f"{prefix}_annotations.csv", ANNOTATION_COLUMNS)
    errors = validate(sentences, annotations)
    approved = fully_approved(sentences) and fully_approved(annotations)
    result = {"status": "INVALID" if errors else "CANDIDATE_STRUCTURE_VALID", "sentences": len(sentences), "annotations": len(annotations), "groups": len({row["paraphrase_group"] for row in sentences}), "humanReview": "RECORDED" if approved else "PENDING", "sourceType": "synthetic_candidate", "runtimeOrModelAcceptance": False, "errors": errors}
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return int(bool(errors) or (args.require_approved and not approved))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, csv.Error) as error:
        print(json.dumps({"status": "INVALID", "error": str(error)}, ensure_ascii=True))
        raise SystemExit(1)
