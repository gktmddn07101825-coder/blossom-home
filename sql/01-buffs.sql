-- BLOSSOM BUFF v8. New tables only; existing profiles, events and todo data stay unchanged.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.guild_buff_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
    icon_key text NOT NULL DEFAULT 'booster'
      CHECK (icon_key IN ('booster','integration','blessing')),
    duration_minutes integer NOT NULL DEFAULT 60
      CHECK (duration_minutes BETWEEN 1 AND 10080),
    sound_key text NOT NULL DEFAULT 'digivice'
      CHECK (sound_key IN ('digivice','digivice_alert','voice')),
    volume integer NOT NULL DEFAULT 70 CHECK (volume BETWEEN 0 AND 100),
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guild_buff_user_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- NULL template_id means an individual personal buff, otherwise an individual override.
    template_id uuid REFERENCES public.guild_buff_templates(id) ON DELETE CASCADE,
    -- NULL override fields mean the user continues inheriting that template default.
    name_override text CHECK (name_override IS NULL OR char_length(btrim(name_override)) BETWEEN 1 AND 60),
    icon_override text CHECK (icon_override IS NULL OR icon_override IN ('booster','integration','blessing')),
    minutes_override integer CHECK (minutes_override IS NULL OR minutes_override BETWEEN 1 AND 10080),
    sound_override text CHECK (sound_override IS NULL OR sound_override IN ('digivice','digivice_alert','voice')),
    volume_override integer CHECK (volume_override IS NULL OR volume_override BETWEEN 0 AND 100),
    -- Only used when template_id IS NULL (personal buff).
    custom_name text CHECK (custom_name IS NULL OR char_length(btrim(custom_name)) BETWEEN 1 AND 60),
    custom_icon text CHECK (custom_icon IS NULL OR custom_icon IN ('booster','integration','blessing')),
    custom_minutes integer CHECK (custom_minutes IS NULL OR custom_minutes BETWEEN 1 AND 10080),
    custom_sound text CHECK (custom_sound IS NULL OR custom_sound IN ('digivice','digivice_alert','voice')),
    custom_volume integer CHECK (custom_volume IS NULL OR custom_volume BETWEEN 0 AND 100),
    -- Server-owned deadline makes timers survive browser closure and new devices.
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT guild_buff_unique_owner_template UNIQUE(owner_id,template_id),
    CONSTRAINT guild_buff_valid_custom CHECK (
      template_id IS NOT NULL OR (
        custom_name IS NOT NULL AND custom_icon IS NOT NULL AND
        custom_minutes IS NOT NULL AND custom_sound IS NOT NULL AND custom_volume IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS guild_buff_entries_owner_idx
 ON public.guild_buff_user_entries(owner_id);
CREATE INDEX IF NOT EXISTS guild_buff_templates_order_idx
 ON public.guild_buff_templates(sort_order,created_at);

CREATE OR REPLACE FUNCTION public.blossom_buff_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS blossom_buff_templates_updated ON public.guild_buff_templates;
CREATE TRIGGER blossom_buff_templates_updated BEFORE UPDATE ON public.guild_buff_templates
FOR EACH ROW EXECUTE FUNCTION public.blossom_buff_set_updated_at();
DROP TRIGGER IF EXISTS blossom_buff_entries_updated ON public.guild_buff_user_entries;
CREATE TRIGGER blossom_buff_entries_updated BEFORE UPDATE ON public.guild_buff_user_entries
FOR EACH ROW EXECUTE FUNCTION public.blossom_buff_set_updated_at();

-- No direct public/anon/authenticated access. All operations go through a JWT-verifying Edge Function.
ALTER TABLE public.guild_buff_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_buff_user_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guild_buff_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.guild_buff_user_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guild_buff_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guild_buff_user_entries TO service_role;
