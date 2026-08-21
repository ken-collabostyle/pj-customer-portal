# クイックスタート

出典: [コラボフォーム JavaScript API クイックスタート](https://collaboform.zendesk.com/hc/ja/articles/16957819932175)

コラボフォーム JavaScript APIを利用する最小手順です。事前に、対象のフォームが作成・公開されている必要があります。

## 1. JavaScriptファイルの作成

フォーム表示時に `alert` でメッセージを表示する処理を作成します。任意のエディタで以下のコードを作成し、`welcome.js` として保存します。

```javascript
(function () {
  "use strict";
  // 公開フォーム表示時にメッセージを表示
  collaboform.events.on("form.show", function (data) {
    alert("welcome! コラボフォームJavaScript API!");
  });
})();
```

`collaboform.events.on()` で、フォーム入力画面が読み込まれた際のイベント `form.show` を検知し、`alert` を実行しています。

### 即時実行パターンとStrictモード

グローバル変数汚染防止のため、**即時実行パターン（IIFE）** での記述を推奨。`"use strict"` 宣言により的確なエラーチェックが行われる。

```javascript
(function () {
  "use strict";
  // ここに処理を記述
})();
```

### ファイル要件

- 拡張子: `.js`
- 文字コード: UTF-8（BOMなし）

## 2. JavaScriptファイルの設定

1. 管理者のメンバーでコラボフォームにログイン
2. フォーム一覧から対象フォームの設定を開く
3. 「カスタマイズ」をクリックし、カスタマイズ画面を表示
4. 「アップロードするファイルの安全性を確認済みです。不正なスクリプトはフォームの利用者に影響を及ぼす可能性があることを理解しています。」のチェックボックスをON
5. 「ファイルをアップロード」をクリックし、`welcome.js` を選択
6. 「保存」をクリック

保存が完了すれば設定完了です。

## 3. 動作確認

対象の公開フォームを開き、フォーム表示と同時に「welcome! コラボフォームJavaScript API!」のalertが表示されれば成功です。

## 次のステップ

- [利用可能な画面とイベント一覧、記述方法](events-reference.md)
- [パーツのデータと状態の操作](parts-reference.md)
