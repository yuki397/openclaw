export enum TypeXMessageEnum {
  text = 0,
  richText = 8,
}

export type TypeXMessage = {
  msg_type: TypeXMessageEnum;
  content: string;
};

export interface TypeXClientOptions {
  token?: string;
  skipConfigCheck?: boolean;
}

export interface TypeXMessageEntry {
  message_id: string;
  chat_id: string;
  sender_id: string;
  sender_name?: string;
  msg_type: TypeXMessageEnum;
  content: string;
  create_time: number;
}

export interface TypeXEventPayload {
  data?: TypeXMessageEntry;
}
