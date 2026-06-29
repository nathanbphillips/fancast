-- Founder 2026-06-29: links now live INSIDE chat (the separate Links feed +
-- compose are retired). A chat message containing a URL has it unfurled on send
-- and rendered as an inline preview card. These columns hold that preview; null
-- when the message has no link. Hidden-row redaction (0011) covers them for free
-- (the whole row is unreadable to non-mods when a message is hidden).
alter table public.chat_messages
  add column if not exists link_url text,
  add column if not exists link_title text,
  add column if not exists link_description text,
  add column if not exists link_image text,
  add column if not exists link_domain text;
