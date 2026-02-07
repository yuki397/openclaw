export enum TypeXMessageEnum {
  text = 0,
  richText = 8,
}

export type TypeXMessage = {
  msg_type: TypeXMessageEnum;
  content: string;
};

export interface TypeXClientOptions {
  email?: string;
  token?: string;
  skipConfigCheck?: boolean;
}
