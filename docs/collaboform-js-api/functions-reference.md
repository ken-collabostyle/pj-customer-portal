# 関数リファレンス

出典: [用意されている関数](https://collaboform.zendesk.com/hc/ja/articles/16957897299343)

`collaboform` グローバルオブジェクトが提供する関数の一覧です。

## `collaboform.events.on()`

イベントハンドラーを登録する関数。

```javascript
collaboform.events.on(eventName, function (data) { });
```

詳細: [events-reference.md](events-reference.md)

## `collaboform.proxy.call()`

外部のREST APIを呼び出す関数（プロキシAPI経由）。

```javascript
collaboform.proxy.call(endpointCode, options).then(function (response) { });
```

詳細: [proxy-api.md](proxy-api.md)

## `collaboform.getLoginUser()`

現在フォームを閲覧しているメンバーの情報を取得する関数。

```javascript
collaboform.getLoginUser();
```

### 戻り値

ログイン済みメンバーの場合はメンバー情報オブジェクトを返す。未ログイン（公開フォームへの匿名アクセス）の場合は `null`。

| プロパティ | 型 | 説明 |
|---|---|---|
| `id` | string | メンバーID |
| `name` | string | 氏名 |
| `email` | string | メールアドレス |
| `role` | string | ロール。`admin`（管理者） / `form_admin`（フォーム管理者） / `guest`（ゲスト）のいずれか |
| `group_name` | string | 所属グループ名 |
| `group_code` | string | 所属グループコード |

### 記述例

```javascript
collaboform.events.on('form.show', function (data) {
  var user = collaboform.getLoginUser();
  if (user) {
    console.log('ログインユーザー:', user.name);
  } else {
    console.log('未ログインユーザー');
  }
});
```

`form.view`（フォーム詳細画面）では、`getLoginUser()` が返すのは**閲覧しているメンバー**の情報（[events-reference.md](events-reference.md) 参照）。
