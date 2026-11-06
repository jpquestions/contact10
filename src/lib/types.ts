/** Row shapes for the tables the app reads. Mirrors supabase/migrations. */
export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  lifetime_points: number;
  active_game_id: string | null;
  seen_widget_intro_launch: boolean;
  seen_widget_intro_first_score: boolean;
  created_at: string;
};

/** Profile fields the client is allowed to change (see the column grants). */
export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'username'
    | 'display_name'
    | 'avatar_url'
    | 'active_game_id'
    | 'seen_widget_intro_launch'
    | 'seen_widget_intro_first_score'
  >
>;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
