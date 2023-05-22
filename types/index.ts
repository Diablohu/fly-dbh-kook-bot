// export WSSignalType
/**
 * WebSocket 信令类型
 * - `0` server -> client | 消息(包含聊天和通知消息)
 * - `1` server -> client | 客户端连接 ws 时, 服务端返回握手结果
 * - `2` client -> server | 心跳，ping
 * - `3` server -> client | 心跳，pong
 * - `4` client -> server | resume, 恢复会话
 * - `5` server -> client | reconnect, 要求客户端断开当前连接重新连接
 * - `6` server -> client | resume ack
 */
export enum WSSignalTypes {
    Message,
    HandShake,
    Ping,
    Pong,
    Resume,
    Reconnect,
    RsumeAck,
}
export interface WSMessageAuthorType {
    id: string;
    username: string;
    identify_num: string;
    online: boolean;
    os: 'Websocket';
    status: 1;
    avatar: string;
    vip_avatar: string;
    banner: string;
    nickname: string;
    roles: number[];
    is_vip: boolean;
    is_ai_reduce_noise: boolean;
    is_personal_card_bg: boolean;
    bot: boolean;
    decorations_id_map: null;
    is_sys: boolean;
}
export interface WSMessageKMarkdownType {
    raw_content: string;
    mention_part: string[];
    mention_role_part: number[];
    channel_part: string[];
}
export enum WSMessageTypes {
    Markdown = 9,
    Card = 10,
    System = 255,
}
export interface WSMessageType {
    channel_type: 'PERSION' | 'GROUP';
    type: WSMessageTypes;
    target_id: string;
    author_id: string;
    content: string;
    extra:
        | {
              type:
                  | 'guild_member_online'
                  | 'guild_member_offline'
                  | 'updated_message';
              body: {
                  user_id: string;
                  event_time: number;
                  guilds: string[];
              };
          }
        | {
              type: WSMessageTypes;
              code: string;
              guild_id: string;
              channel_name: string;
              author: WSMessageAuthorType;
              visible_only: null;
              mention: string[];
              mention_all: boolean;
              mention_roles: number[];
              mention_here: false;
              nav_channels: string[];
              kmarkdown: WSMessageKMarkdownType;
              emoji: string[];
              quote?: {
                  id: string;
                  rong_id: string;
                  content: string;
                  create_at: number;
                  author: WSMessageAuthorType;
                  kmarkdown: WSMessageKMarkdownType;
              };
              last_msg_content: string;
              send_msg_device: 0;
          };
    msg_id: string;
    msg_timestamp: number;
    nonce: string;
    from_type: 1;
}

// ============================================================================

export type MessageType = {
    type: 1 | 9 | 10;
    target_id: string;
    content: string;
    quote?: string;
    nonce?: string;
    msg_id?: string;
    discord_msg_id?: string;
};

// ============================================================================
export type MessageSource = 'discord' | 'twitter' | 'youtube';

export type SizeType = 'xs' | 'sm' | 'md' | 'lg';
export type ModuleType =
    | {
          type:
              | 'section'
              | 'context'
              | 'kmarkdown'
              | 'plain-text'
              | 'image'
              | 'image-group'
              | 'container'
              | 'video'
              | 'divider';
          src?: string;
          content?: string;
          elements?: ModuleType[];
          title?: string;
          text?: ModuleType;
          size?: SizeType;
          mode?: 'left' | 'right';
          accessory?: ModuleType;
      }
    | undefined;
export type CardMessageType = {
    type: 'card';
    theme?: 'primary' | 'warning' | 'danger' | 'info' | 'none' | 'secondary';
    color?: string;
    size?: SizeType;
    modules: ModuleType[];
};
