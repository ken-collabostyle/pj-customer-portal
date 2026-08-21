# コラボフォーム JavaScript API リファレンス

本プロジェクト（顧客向けマイページ）は、コラボフローとコラボフォームをベースに構築し、カスタマイズはコラボフォームの **JavaScript API** を用いて実装する方針です（詳細は [inception-deck.md](../../inception-deck.md) を参照）。

本フォルダは、コラボフォームサポートサイトの「[カスタマイズ](https://collaboform.zendesk.com/hc/ja/sections/16842707276175)」セクション配下にある全15記事の内容を、開発で参照しやすいようテーマ別に再構成したナレッジベースです。2026-08-21時点の公開内容を基にしています。仕様変更の可能性があるため、重要な判断を行う際は原文リンクも合わせて確認してください。

## ファイル一覧

| ファイル | 内容 |
|---|---|
| [overview.md](overview.md) | JavaScript API/CSSの概要、利用準備、制限事項 |
| [quickstart.md](quickstart.md) | 最小構成でのカスタマイズ手順（JSファイル作成〜適用） |
| [events-reference.md](events-reference.md) | 利用可能な画面とイベント一覧、イベントの記述方法、画面別イベント詳細 |
| [parts-reference.md](parts-reference.md) | `parts` オブジェクト（パーツの値・状態）の参照・操作方法 |
| [functions-reference.md](functions-reference.md) | `collaboform` グローバルオブジェクトが提供する関数一覧 |
| [proxy-api.md](proxy-api.md) | プロキシAPI（外部REST API連携）の設定方法と `collaboform.proxy.call()` の使い方 |

## 本プロジェクトでの位置づけ

スコープ（[inception-deck.md](../../inception-deck.md) 4章）にある以下の要件は、いずれも本APIの組み合わせで実現する想定です。

- kintoneからの現在契約情報・商品マスターの取得 → [proxy-api.md](proxy-api.md)（`collaboform.proxy.call()` による外部API連携）
- プラン変更・一部解約・年額変更等の受付処理、各種入力チェック → [events-reference.md](events-reference.md)（`form.confirm` / `form.submit` 等でのバリデーション）、[parts-reference.md](parts-reference.md)（パーツ値の取得・変更）

## 最小のクイックリファレンス

```javascript
(function () {
  "use strict";

  // イベント登録
  collaboform.events.on("form.show", function (data) {
    // data.parts でパーツの値・状態を参照/変更できる
  });

  // 外部API（プロキシAPI経由）呼び出し
  collaboform.proxy.call("endpointCode", { query: { key: "value" } })
    .then(function (response) { /* ... */ })
    .catch(function (error) { /* ... */ });

  // ログインユーザー取得
  var user = collaboform.getLoginUser();
})();
```

## 参照元

- [コラボフォームサポート「カスタマイズ」セクション](https://collaboform.zendesk.com/hc/ja/sections/16842707276175)（全15記事）
- 背景知識: [コラボフォームとは？](https://collaboform.zendesk.com/hc/ja/articles/8462764060943)
