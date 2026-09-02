// コラボフォームJavaScript APIのグローバル型定義。
// 出典: docs/collaboform-js-api/README.md 配下の各ドキュメント。
// 実際に使用しているプロパティ・メソッドのみを定義する（フェーズが進むごとに追記）。

interface CollaboformPartValue<T = unknown> {
  type: string;
  enabled: boolean;
  display: boolean;
  value: T;
}

interface CollaboformEventData {
  event_name: string;
  parts: Record<string, CollaboformPartValue>;
  parts_id?: string;
  row_index?: number;
  table_id?: string;
}

type CollaboformEventHandlerResult = boolean | void | Promise<boolean | void>;

interface CollaboformEvents {
  on(
    eventName: string | string[],
    handler: (data: CollaboformEventData) => CollaboformEventHandlerResult
  ): void;
}

interface CollaboformProxyResponse {
  success: boolean;
  status: number;
  headers: Record<string, string>;
  body_type: "string" | "object" | "base64";
  body: unknown;
}

interface CollaboformProxyCallOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  parseType?: "json" | "text" | "base64";
}

interface CollaboformProxy {
  call(
    endpointCode: string,
    options?: CollaboformProxyCallOptions
  ): Promise<CollaboformProxyResponse>;
}

interface Collaboform {
  events: CollaboformEvents;
  proxy: CollaboformProxy;
}

declare const collaboform: Collaboform;
