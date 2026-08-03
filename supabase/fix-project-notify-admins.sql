-- Re-run this in Supabase SQL Editor to pick up admin/SA fan-out on project create.
-- (Safe to re-run; replaces the notify function + trigger only.)

CREATE OR REPLACE FUNCTION public.notify_on_project_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator  profiles%ROWTYPE;
  mgr      profiles%ROWTYPE;
  grandmgr profiles%ROWTYPE;
  recip    RECORD;
  body_txt TEXT;
  title_txt TEXT;
  payload_json JSONB;
BEGIN
  SELECT * INTO creator FROM profiles WHERE id = NEW.created_by;
  IF creator.id IS NULL THEN
    RETURN NEW;
  END IF;

  body_txt := COALESCE(creator.full_name, creator.email) || ' created: ' || NEW.name
    || ' (' || INITCAP(REPLACE(NEW.status, '_', ' ')) || ')';
  title_txt := CASE
    WHEN NEW.status = 'unassigned' THEN 'New project needs review'
    ELSE 'New project created'
  END;
  payload_json := jsonb_build_object(
    'project_id', NEW.id,
    'project_name', NEW.name,
    'client_id', NEW.client_id,
    'actor_id', creator.id,
    'actor_name', COALESCE(creator.full_name, creator.email),
    'status', NEW.status
  );

  IF creator.role IN ('team_leader', 'sales') AND creator.manager_id IS NOT NULL THEN
    SELECT * INTO mgr FROM profiles WHERE id = creator.manager_id;

    IF mgr.id IS NOT NULL AND mgr.id <> creator.id AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = mgr.id
        AND n.type = 'project_created'
        AND n.payload->>'project_id' = NEW.id::text
        AND n.created_at > NOW() - INTERVAL '1 minute'
    ) THEN
      INSERT INTO notifications(user_id, type, title, body, payload)
      VALUES (mgr.id, 'project_created', title_txt, body_txt, payload_json);
    END IF;

    IF creator.role = 'sales' AND mgr.manager_id IS NOT NULL THEN
      SELECT * INTO grandmgr FROM profiles WHERE id = mgr.manager_id;
      IF grandmgr.id IS NOT NULL
         AND grandmgr.id <> creator.id
         AND grandmgr.role IN ('admin', 'super_admin', 'team_leader')
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = grandmgr.id
             AND n.type = 'project_created'
             AND n.payload->>'project_id' = NEW.id::text
             AND n.created_at > NOW() - INTERVAL '1 minute'
         )
      THEN
        INSERT INTO notifications(user_id, type, title, body, payload)
        VALUES (grandmgr.id, 'project_created', title_txt, body_txt, payload_json);
      END IF;
    END IF;
  END IF;

  -- Always notify every Admin and Super Admin (activators), except creator
  FOR recip IN
    SELECT id FROM profiles
    WHERE role IN ('admin', 'super_admin')
      AND id <> creator.id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = recip.id
        AND n.type = 'project_created'
        AND n.payload->>'project_id' = NEW.id::text
        AND n.created_at > NOW() - INTERVAL '1 minute'
    ) THEN
      INSERT INTO notifications(user_id, type, title, body, payload)
      VALUES (recip.id, 'project_created', title_txt, body_txt, payload_json);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_project_created ON projects;
CREATE TRIGGER trg_notify_project_created
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_project_created();
