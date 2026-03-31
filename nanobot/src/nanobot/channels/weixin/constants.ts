/**
 * 与上游 `nanobot/channels/weixin.py`、openclaw-weixin types 对齐的协议常量。
 */

export const ITEM_TEXT = 1;
export const ITEM_IMAGE = 2;
export const ITEM_VOICE = 3;
export const ITEM_FILE = 4;
export const ITEM_VIDEO = 5;

/** 1 = 用户 → 机器人 */
export const MESSAGE_TYPE_USER = 1;
/** 2 = 机器人发出 */
export const MESSAGE_TYPE_BOT = 2;

export const MESSAGE_STATE_FINISH = 2;

export const WEIXIN_MAX_MESSAGE_LEN = 4000;
export const WEIXIN_CHANNEL_VERSION = "1.0.3";

export const BASE_INFO = { channel_version: WEIXIN_CHANNEL_VERSION };

/** 会话过期：上游会暂停轮询一段时间 */
export const ERRCODE_SESSION_EXPIRED = -14;
export const SESSION_PAUSE_MS = 60 * 60 * 1000;

export const DEFAULT_LONG_POLL_TIMEOUT_S = 35;
export const MAX_QR_REFRESH = 3;
