# プロキシAPI（外部API連携）

出典:
- [プロキシAPIとは？](https://collaboform.zendesk.com/hc/ja/articles/16957949018767)
- [プロキシAPI一覧](https://collaboform.zendesk.com/hc/ja/articles/16957943668879)
- [プロキシAPIの詳細と編集](https://collaboform.zendesk.com/hc/ja/articles/16957964391055)
- [外部のAPIを実行する](https://collaboform.zendesk.com/hc/ja/articles/16957924434703)

本プロジェクトのkintone連携（現在契約情報の取得、商品マスター参照）は、このプロキシAPI機構を経由して実装する想定です。

## プロキシAPIとは？

プロキシAPIを使用すると、コラボフォームJavaScript APIから外部のAPIを呼び出せます。通常ブラウザから直接外部APIを呼ぶとAPIキー等の認証情報がユーザーのブラウザ上に露出しますが、プロキシAPIを使うと認証情報は**コラボフォームのサーバー側で管理**され、フォームの利用者には露出しません。

### 仕組み

1. コラボフォームJavaScript APIから `collaboform.proxy.call()` を呼び出す
2. コラボフォームのサーバーが管理者の設定した認証情報をリクエストに付与する
3. 外部APIにリクエストを送信する
4. レスポンスをフォームに返す

プロキシAPIは**ワークスペース全体で共有**されます。同じワークスペースの管理者であれば、どのフォームからでも同じエンドポイントを利用できます。

## プロキシAPIエンドポイントの管理（管理画面）

管理画面のナビゲーション「設定＞プロキシAPI」からエンドポイント一覧を開けます。設定操作は**管理者のみ**可能。

### 一覧に表示される情報

| 項目 | 説明 |
|---|---|
| エンドポイントコード | カスタムJavaScriptから呼び出す際に使用するコード（例: `my-api-endpoint`） |
| HTTPメソッド | GET / POST / PUT / PATCH / DELETE |
| 接続先ホスト | 外部APIのホストURL |
| ステータス | 有効 / 無効 |
| 最終更新日時 | エンドポイントの最終更新日時 |

エンドポイントコードは同一ワークスペース内で重複不可。

### エンドポイント作成・編集で設定できる項目

| 項目 | 必須 | 説明 |
|---|---|---|
| エンドポイントコード | 必須 | `collaboform.proxy.call('コード', ...)` で指定するキー。英数字・ハイフン・アンダースコアのみ、50文字以内 |
| HTTPメソッド | 必須 | GET / POST / PUT / PATCH / DELETE |
| 接続先ホスト | 必須 | `https://` から始まるURL（`localhost`・ローカルネットワークアドレス禁止）。英数字・ハイフン・ドットのみ。ポート指定は `:ポート番号`。最大512文字 |
| パス | 任意 | ホストに続くパス（例: `/api/v1/users`） |
| クエリパラメーター | 任意 | key-value形式 |
| リクエストヘッダー | 任意 | key-value形式（APIキー・Bearer Token等） |
| リクエストボディ | 任意 | JSON形式 |
| ステータス | 必須 | 有効 / 無効 |

### テンプレート変数

パス・ヘッダー値・クエリパラメーター値・リクエストボディに `${user.xxx}` の形式で埋め込むと、実行時にログイン済みメンバーの情報へ自動置換されます（ヘッダー・クエリパラメーターの**キー**には使用不可）。

| テンプレート変数 | 置き換えられる値 |
|---|---|
| `${user.id}` | ログイン済みメンバーのID |
| `${user.name}` | 氏名 |
| `${user.email}` | メールアドレス |
| `${user.role}` | ロール（`admin` / `form_admin` / `guest`） |
| `${user.group_name}` | 所属グループ名 |
| `${user.group_code}` | 所属グループコード |

未ログイン（匿名アクセス）の場合、テンプレート変数は空文字として扱われます。

### 管理側設定の制限事項

- **エンドポイントコード**: 英数字・ハイフン・アンダースコアのみ、50文字以内、同一ワークスペース内で重複不可
- **接続先ホスト**: `https://` のみ（`http://` 不可）、`localhost`/ローカルネットワークアドレス禁止、英数字・ハイフン・ドットのみ、最大512文字
- **リクエストヘッダー**: キー・値ともにASCII文字のみ。テンプレート変数解決後の値に非ASCII文字（日本語の氏名等）が含まれると外部API呼び出しが失敗する
- **リクエストボディ**: HTTPメソッドがGET/HEAD/DELETEの場合、設定した値は外部APIに送信されない

### 注意点

- エンドポイントを削除すると、それを使用しているJavaScriptカスタマイズの呼び出しは `404 Not Found` エラーになる。JavaScript側も合わせて更新すること。
- 無効化したエンドポイントへの呼び出しも `404 Not Found` として扱われる。

## クライアント側：`collaboform.proxy.call()`

`collaboform.proxy.call()` は非同期処理でPromiseを返します。サーバーからの応答受信後に `then()` のハンドラーが呼ばれます。`form.confirm` / `form.submit` ハンドラーで戻り値を `return` すると、API呼び出し完了まで画面遷移が待機されます（[events-reference.md](events-reference.md) 参照）。

```javascript
collaboform.proxy.call(endpointCode, options).then(function (response) {
  // 応答受信後の処理
}).catch(function (error) {
  // 失敗時の処理（タイムアウトなど）
});
```

### 引数

| 引数名 | タイプ | 説明 |
|---|---|---|
| `endpointCode` | string | 管理者が設定したエンドポイントコード |
| `options` | object | 追加のリクエスト情報（任意） |

### `options` の詳細

| プロパティ | タイプ | 説明 |
|---|---|---|
| `headers` | object | 追加のリクエストヘッダー。管理者設定と重複した場合は管理者設定が優先 |
| `query` | object | 追加のクエリパラメーター。管理者設定と重複した場合は管理者設定が優先 |
| `body` | object | リクエストボディ。管理者設定とオブジェクト単位で再帰的にマージ（同一キーは管理者設定優先、`options` 側のみのキーは保持） |
| `parseType` | string | 受信ボディの変換方法。`json`（デフォルト） / `text` / `base64` |

#### `body` のマージ挙動

```javascript
// プロキシAPI設定の body
// { "sender": { "name": "system", "address": "no-reply@example.com" } }

collaboform.proxy.call('notify-endpoint', {
  body: {
    sender: {
      name: 'user',               // 管理者設定が優先されるため上書きされない
      replyTo: 'user@example.com' // options 側にしかないキーは追加される
    }
  }
});

// 実際に送信される body
// {
//   "sender": {
//     "name": "system",               // 管理者設定が優先
//     "address": "no-reply@example.com",
//     "replyTo": "user@example.com"   // options 側のキーが追加される
//   }
// }
```

- HTTPメソッドがGET/HEAD/DELETEの場合、`options.body` は無視される。
- `options.body` を指定すると、`Content-Type: application/json` が自動付与される（既に管理者設定または`options`側で `Content-Type` が指定されていればその値を使用）。

#### `parseType`

| 値 | 説明 |
|---|---|
| `json` | JSONとして自動変換（デフォルト）。`response.body` はオブジェクト型 |
| `text` | プレーンテキストとして返す。`response.body` は文字列型 |
| `base64` | BASE64エンコードして返す。画像ファイル等の受信に有用 |

### 完了ハンドラー（`then`）の `response` オブジェクト

| プロパティ | タイプ | 説明 |
|---|---|---|
| `success` | boolean | ステータスが200〜299または304なら `true`、4xx/5xxなら `false` |
| `status` | number | 応答HTTPステータスコード |
| `headers` | object | 受信ヘッダー |
| `body_type` | string | `string` / `object` / `base64` のいずれか |
| `body` | string / object | 受信ボディ |

外部APIが4xx/5xxを返した場合も `then()` が呼ばれます（`success: false`）。処理の分岐には `success` または `status` を参照してください。

### エラーハンドラー（`catch`）

| エラーの種類 | 受け取り方 |
|---|---|
| 外部APIが4xx/5xxを返した | `.then()` が呼ばれる（`response.success` が `false`） |
| タイムアウト（120秒超過） | `.catch()` が呼ばれる |
| 通信障害 | `.catch()` が呼ばれる |
| `options` の指定が不正（`query`/`headers` にオブジェクト以外、`parseType` に無効な値） | `.catch()` が呼ばれる |

### 記述例

#### クエリパラメーターを追加する

```javascript
collaboform.events.on('form.show', function (data) {
  collaboform.proxy.call('search-endpoint', {
    query: { keyword: data.parts['fidSearchWord'].value }
  }).then(function (response) {
    if (response.success) {
      console.log('検索結果:', response.body);
    } else {
      console.log('外部APIエラー:', response.status);
    }
  }).catch(function (error) {
    console.error('通信エラーが発生しました');
  });
});
```

#### リクエストボディを追加する

```javascript
collaboform.events.on('form.show', function (data) {
  collaboform.proxy.call('notify-endpoint', {
    body: {
      name: data.parts['fidName'].value,
      email: data.parts['fidEmail'].value
    }
  }).then(function (response) {
    // 応答受信後の処理
  }).catch(function () {
    // エラー時の処理
  });
});
```

#### テキストレスポンスを受け取る

```javascript
collaboform.proxy.call('text-endpoint', {
  parseType: 'text'
}).then(function (response) {
  console.log(response.body); // 文字列
});
```

#### 確認画面への遷移をAPIコール完了まで待機する

`form.confirm` ハンドラーで `proxy.call()` の戻り値を `return` すると、APIコール完了まで確認画面への遷移が待機されます（`form.submit` も同様）。`.then()` 内で `return false` すると遷移をキャンセルできます。`.catch()` が呼ばれた場合（通信エラー等）は遷移が継続されます。

```javascript
collaboform.events.on('form.confirm', function (data) {
  return collaboform.proxy.call('validate-endpoint')
    .then(function (response) {
      if (!response.success) {
        return false; // 遷移をキャンセル
      }
    }).catch(function () {
      // 通信エラー時は遷移を継続
    });
});
```

## 制限事項（共通）

- 接続先プロトコルは `https://` のみ対応（管理者がエンドポイント設定で指定。`http://` は不可）
- `localhost` およびローカルネットワークアドレスへの接続は禁止
- 受信できるボディの上限は **10MiB（10,485,760バイト）**
- 応答待ち時間（受信タイムアウト）は **120秒**
- リダイレクト非対応。外部APIが3xxを返した場合、そのままレスポンスとして返される
- `options.headers` の値にASCII文字以外（日本語等）を含めると呼び出しは行われず、`{ success: false, status: 400 }` で完了ハンドラーが呼ばれる
- `options.headers` では以下のヘッダーは指定不可: `Host`, `Authorization`, `X-Forwarded-For`, `X-Forwarded-Host`, `Transfer-Encoding`, `Content-Length`
- 利用したい外部APIサービスでIPアドレス制限をしている場合、以下のIPアドレスからのアクセスを許可する必要がある:
  - `18.178.206.89`
  - `54.64.93.248`
