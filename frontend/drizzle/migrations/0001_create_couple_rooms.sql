CREATE TABLE public.couple_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.room_members (
  room_id UUID NOT NULL REFERENCES public.couple_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE UNIQUE INDEX room_members_one_room_per_user ON public.room_members (user_id);
CREATE INDEX room_members_room_idx ON public.room_members (room_id);

GRANT SELECT ON public.couple_rooms TO authenticated;
GRANT ALL ON public.couple_rooms TO service_role;
GRANT SELECT ON public.room_members TO authenticated;
GRANT ALL ON public.room_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_room_member(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

ALTER TABLE public.couple_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their room"
ON public.couple_rooms FOR SELECT TO authenticated
USING (public.is_room_member(id, auth.uid()));

CREATE POLICY "Members can view memberships of their room"
ON public.room_members FOR SELECT TO authenticated
USING (public.is_room_member(room_id, auth.uid()));
