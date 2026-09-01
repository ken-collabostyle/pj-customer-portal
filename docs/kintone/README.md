# kintone連携情報

コラボフォームのカスタマイズで参照するkintoneアプリ（契約管理アプリ・商品マスターアプリ等）の**非秘匿情報**を整理するフォルダです。

## 記載してよいもの／いけないもの

- ○ アプリID、アプリ名、フィールドコード、フィールド名、ドメイン（`https://xxx.cybozu.com` 等）、認証方式の種類（APIトークン方式／パスワード方式などの区別）
- × APIトークンの値、パスワード、その他の認証情報の実値

実際の認証情報は[.env.example](../../.env.example)のキーに対応する値をローカルの`.env`（gitignore対象、リポジトリには含まれない）に設定して管理します。kintoneのAPIトークンは**アプリごと**に権限が分かれるため、アプリごとに個別のキーを用意しています（`KINTONE_BASE_URL`はkintone環境共通、`KINTONE_CONTRACT_DB_APP_ID` / `KINTONE_CONTRACT_DB_API_TOKEN`がクラウド契約管理DB用、`KINTONE_PRODUCT_MASTER_APP_ID` / `KINTONE_PRODUCT_MASTER_API_TOKEN`が商品マスタ用）。このフォルダやチャット・コミットメッセージに実値を書き込まないでください。

## kintone APIトークンの主な用途

本プロジェクトのkintone連携は、コラボフォームの[プロキシAPI](../collaboform-js-api/proxy-api.md)機構を経由する想定です。この場合、APIトークンはコラボフォーム管理画面（設定＞プロキシAPI）の「リクエストヘッダー」に管理者が直接設定するため、このリポジトリのコードや`.env`を経由する必要はありません。

`.env`の`KINTONE_CONTRACT_DB_API_TOKEN` / `KINTONE_PRODUCT_MASTER_API_TOKEN`は、開発時にkintone REST APIへ直接疎通確認する場合など、ローカル作業用の補助的な用途を想定したものです。実装するJavaScriptカスタマイズ本体にはkintoneの認証情報を一切埋め込みません。

## ファイル構成

要求事項に登場するkintoneアプリごとに、アプリID・フィールドコード対応表をMarkdownで追加していきます。

| ファイル | 内容 | 状態 |
|---|---|---|
| [クラウド契約管理DB.md](クラウド契約管理DB.md) | 「顧客番号」をキーに、インスタンス名・法人／団体名・現在契約プラン・現在契約ユーザー数・商品コード等を取得するためのアプリID・フィールドコード対応表 | 済（2026-08-25） |
| [商品マスタ.md](商品マスタ.md) | 新規追加オプションの定価（`標準売価`）を取得するためのアプリID・フィールドコード対応表。クラウド契約管理DBの`製品型番`と`メーカー型番`で突合する | 済（2026-08-25） |

当初「契約管理アプリ」「商品マスターアプリ」の2アプリを想定していましたが、2026-08-25時点でアプリ「クラウド契約管理DB」の「顧客番号」キー検索により契約情報が一括取得できることが判明。定価情報のみ別アプリ「商品マスタ」が必要なことが分かり、結果的に当初想定どおり2アプリ構成となりました。

## プロキシAPIエンドポイント設計（コラボフォーム管理画面での設定が必要）

kintoneの2アプリへアクセスするため、コラボフォームの管理画面「設定＞プロキシAPI」で以下の2エンドポイントを**管理者が**作成する必要があります。この設定はUIでの手作業のみで、APIでの自動化はできません（[proxy-api.md](../collaboform-js-api/proxy-api.md)参照）。

kintone REST APIの`GET /k/v1/records.json`は「アプリID」「検索条件（query）」をクエリパラメーターとして受け取りますが、これらは秘匿情報ではないため、管理画面には固定設定せず、JavaScript側から`collaboform.proxy.call()`の`options.query`で都度渡す設計にします。管理画面で固定するのは接続先ホストと認証ヘッダーのみです。

### エンドポイント1：`kintone-contract-db`（クラウド契約管理DB用）

| 項目 | 設定値 |
|---|---|
| エンドポイントコード | `kintone-contract-db` |
| HTTPメソッド | GET |
| 接続先ホスト | `https://devaqvqwv.cybozu.com` |
| パス | `/k/v1/records.json` |
| クエリパラメーター | 空（JS側から`app`・`query`を渡す） |
| リクエストヘッダー | `X-Cybozu-API-Token` = `.env`の`KINTONE_CONTRACT_DB_API_TOKEN`と同じ値を**直接入力**（Claudeには渡さない） |
| ステータス | 有効 |

### エンドポイント2：`kintone-product-master`（商品マスタ用）

| 項目 | 設定値 |
|---|---|
| エンドポイントコード | `kintone-product-master` |
| HTTPメソッド | GET |
| 接続先ホスト | `https://devaqvqwv.cybozu.com` |
| パス | `/k/v1/records.json` |
| クエリパラメーター | 空（JS側から`app`・`query`を渡す） |
| リクエストヘッダー | `X-Cybozu-API-Token` = `.env`の`KINTONE_PRODUCT_MASTER_API_TOKEN`と同じ値を**直接入力**（Claudeには渡さない） |
| ステータス | 有効 |

### JavaScript側の呼び出しイメージ（フェーズ1で実装）

```javascript
collaboform.proxy.call('kintone-contract-db', {
  query: { app: 73, query: `顧客番号="${customerNumber}"` }
}).then(function (response) {
  // response.body.records に明細行が入る
});
```

商品マスタのアプリIDは`.env`の`KINTONE_PRODUCT_MASTER_APP_ID`を参照。

### 設定状況

- 上記2エンドポイントの作成はユーザー自身（コラボフォーム管理者権限を保有）が検証環境で行う（2026-08-25確認）。作成完了後、Playwright MCPでの動作確認に進む。
