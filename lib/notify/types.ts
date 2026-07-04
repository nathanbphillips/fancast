/**
 * Notification type registry (FR-21.2). Each type has independent email + push
 * defaults; an absent notification_prefs row means the default here applies, so
 * only deviations are stored. This is the single source of truth for what
 * notification types exist and how they default.
 */

export type NotificationType =
  | "room_scheduled"
  | "pre_start_reminder"
  | "go_live"
  | "rsvp_reminder"
  | "room_change"
  | "cohost_invite"
  | "cohost_response"
  | "friend_request"
  | "friend_accept";

export type NotificationChannel = "email" | "push";

export type TypeMeta = {
  /** short label for the settings Notifications section */
  label: string;
  /** one-line description shown under the label */
  description: string;
  emailDefault: boolean;
  pushDefault: boolean;
};

export const NOTIFICATION_TYPES: Record<NotificationType, TypeMeta> = {
  room_scheduled: {
    label: "New rooms scheduled",
    description: "When a commentator you follow schedules a room.",
    emailDefault: true,
    pushDefault: true,
  },
  pre_start_reminder: {
    label: "Show starting soon",
    description: "15 minutes before a followed room goes on air.",
    emailDefault: false,
    pushDefault: true,
  },
  go_live: {
    label: "Live now",
    description: "When a followed commentator opens their room.",
    emailDefault: true,
    pushDefault: true,
  },
  rsvp_reminder: {
    label: "Your room is starting",
    description: "30 minutes before a room you RSVP'd to.",
    emailDefault: true,
    pushDefault: true,
  },
  room_change: {
    label: "Room changes",
    description: "When a room you host or RSVP'd to is moved or canceled.",
    emailDefault: true,
    pushDefault: true,
  },
  cohost_invite: {
    label: "Co-host invites",
    description: "When another commentator invites you to co-host.",
    emailDefault: true,
    pushDefault: true,
  },
  cohost_response: {
    label: "Co-host responses",
    description: "When someone accepts or declines your co-host invite.",
    emailDefault: true,
    pushDefault: true,
  },
  friend_request: {
    label: "Friend requests",
    description: "When someone sends you a friend request.",
    emailDefault: true,
    pushDefault: true,
  },
  friend_accept: {
    label: "Friend request accepted",
    description: "When someone accepts your friend request.",
    emailDefault: false,
    pushDefault: true,
  },
};

export function isNotificationType(v: string): v is NotificationType {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, v);
}

/** Channel default from the registry. */
export function channelDefault(
  type: NotificationType,
  channel: NotificationChannel,
): boolean {
  const meta = NOTIFICATION_TYPES[type];
  return channel === "email" ? meta.emailDefault : meta.pushDefault;
}
