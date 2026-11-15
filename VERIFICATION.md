# 検証記録

## 2026-11-16 連続配列型辞書エンジン

- 0.3.1。辞書検索をコードポイント順・幅優先配置のTypedArrayへ分離し、ノードごとのMap/オブジェクトを常駐させない構造へ変更。設定・CSV交換形式・公開MCP・最長一致/再置換なし/ASCII境界/分割用範囲は維持する。内部改善としてパッチ更新した。
- 発行前レビューで構築/探索、補助平面・単独サロゲート・空辞書・長い登録語、入力編集からの索引の独立、同梱ファイルを確認。新エンジンの配布漏れを防ぐためpublishの対象と本体結合試験のfixtureコピーを更新した。未解決の指摘なし。
- 指定Node 26.13.1の単体12件が成功。独立した逐次比較による100組の結果/範囲照合、10万件の最初/最後/重複接頭辞、1万文字の登録語、従来のCSV・分割・MCP受付・プレビューを検証。publish内でも同12件が成功した。
- 同じ合成CSVで旧Map版と新エンジンを各別プロセスで比較。10万件の保持量（ヒープ+ArrayBuffer増分）は旧134.07〜185.81MiB、新11.27〜14.65MiB。1万文字の置換中央値は旧0.332〜0.441ms、新0.279〜0.627ms。新エンジン構築は135.391〜151.778ms。全プロセスの構築等を含むピークRSSは最大373.84MiBで、保持量とは区別する。実辞書/全体UI/複数辞書マージの測定ではない。再現用コマンドは`dev.bat exec node --expose-gc ../Applet.Speak.at365/scripts/dictionary-benchmark.cjs <出力先>`。
- 発行済みSpeak 0.3.1と固定AppDock 0.248.0による結合10群が成功。辞書の確定/取消、プレビュー、明暗と狭幅、MCP受付と分割/再生順序、公開OFF/停止後の受付済み継続、再起動を確認。Relay指定なしのためRelay群は対象外。実サービス品質と物理音声出力は未確認。
- 証跡は`.artifacts/packed-engine-20261116/`のbenchmark、publish/fixed-integrationログ。隔離profileは本体`.artifacts/applet-api-portable-1794760669150/`。fixtureは発行済み`src/*.cjs`をすべてコピーしており、初回resultにないエンジンのハッシュはpublication証跡で補完する。本体試験の追記は同じコピー対象をハッシュ列挙にも再利用する記録のみの変更として、結合の成功結果を再利用した。
- 共通publishで更新ZIP/feedを発行。ZIP SHA-256=`7adefa812ac388ec1bedd66ed0d41962d7efb417fc0360de3ca7ede8b9006351`。本体製品は変更せず、共通ファイルStorageとCSV保存/複数辞書管理は後続。push・外部公開・実利用先配置は行っていない。

## 2026-11-15 設定・ユーザー辞書タブ

- 0.3.0、minimumHostVersion 0.247.0。本体の宣言型`settingsTabs`で「設定」「ユーザー辞書」を分け、辞書のON/OFFは設定、通常の`dictionary`一覧はユーザー辞書へ置いた。表示名を「ユーザー辞書」へ揃え、保存キー・CSV形式・公開MCPの4入力とaccepted応答を保持した。
- CSVファイル/貼り付けの取り込みメニューと書き出しはユーザー辞書タブの隣、文章プレビューは設定タブの隣へ移した。将来の配布辞書タブを同じ宣言へ追加できる。配布辞書取り込み自体は実装していない。
- `publish.bat`内の単体9件が成功。通常のローカル発行先に生成し、manifest/feedの版・最低ホスト版・ZIPの容量/SHA-256と全3項目をrepo原本・展開済み発行物へ照合した。ZIP SHA-256=`f127d89c12f2f2e98f92ad1bab018e757e02f0c9080ad781675c7512781984ca`。
- 固定AppDock 0.247.0・発行済みSpeak・隔離Relay 0.3.0による本体結合11群が成功。辞書の編集/取消/取り込み、タブ補助操作のキーボード移動、検索からのタブ選択、情報パネルのJSON表示、タブリセットによる辞書と公開ONの保護、読み上げ受付・分割と順序・再起動を検証した。物理出力と実サーバーの音声品質はfixture試験に含めない。
- 本体の関連単体97件、情報パネル13群、About 5群、共通ボタン3群も成功。詳細ログ/profile/hashは本体`.artifacts/applet-settings-tabs-20261115/`、入力とcommit照合は本repo`.artifacts/commit-validation-settings-tabs-20261115/`。発行ログは`.artifacts/publish-settings-tabs-20261115.log`。専用fixtureバイナリーを回収し、共通ランタイムと検証証跡を保持。push・公開・実利用先配置は行っていない。

## 2026-11-15 Speakへの識別名統一

- Git履歴とmainを保持してrepoフォルダーを`Applet.Speech.at365`から`Applet.Speak.at365`へ移動。正式名を`Applet.Speak.at365`、Applet IDを`at365.speak`、モジュールIDを`at365.speak.read-aloud`へ統一し、通常の発行先も`Applet.Speak.at365/extensions/at365.speak`へ揃えた。旧repo/発行先フォルダーが残らないことを確認した。
- 旧IDの設定・公開ON/OFFは別扱いとし、移行や別名を追加していない。MCP公開名`appdock_speech_speak`と4入力/accepted応答はRelay/Voiceとの共通契約として維持する。Applet識別子の破壊的変更を含むため0.2.0へマイナー更新。旧版との二重提供を避ける導入手順を利用ガイドへ記載した。
- 発行前レビューで宣言/handler/設定参照/配置/文書リンクを確認。既存Applet9件、本体のMCP/監査/提供者26件と共有fixtureのAutomation35件が成功。旧Speechモジュールの保存済みONではSpeakが有効にならないことも検査した。
- 共通publishでローカル発行し、更新feed/manifestの新ID・正式名・版、ZIP全3項目とrepo原本/発行物のSHA-256を照合。固定AppDock 0.246.0・新IDの発行済みSpeak・隔離Relayで既存結合11群が成功。専用fixtureバイナリーを回収済み。証跡は`.artifacts/speak-rename-20261115/`と本体の同名フォルダー。
- update.zip SHA-256: `c94540332514e807fed30b1625ddec11e832e548d9bf0908403b083bd7894ac7`。manifest: `52ee999625973043b75ad1f6ddd5cd1d92bea066b75339fb42c1e4c8e1add11a`。index: `3f46cb2a1a79fb6ce477a13954515953d6c4beea77f289a226bf8afb948dae92`。文章処理本体の内容ハッシュは0.1.1と同じ。

本体製品の変更・発行、実利用先への配置、remote作成/変更、push/外部公開は行っていない。旧IDの利用者設定は操作していない。

## 2026-11-15 Speakの表示名と紹介文

- displayNameを`Speak`、taglineを`AIの言葉に、声を。`へ設定。概要とMCP表示タイトル/モジュール説明、利用ガイドを更新した。Applet ID・モジュールID・公開ツール名/Schema・通常設定・配置先・リポジトリ名は維持する。公開API/設定の追加変更を伴わない表示更新として0.1.1へパッチ更新した。
- 発行前に表示メタデータと影響範囲をレビューし、指摘なし。既存9件が成功し、共通publishでローカル発行した。update.json/manifestの版、名前・紹介文、ZIP全3項目とrepo/発行物のSHA-256を照合した。証跡は`.artifacts/speak-branding-20261115/`。
- 発行済み本Applet・固定AppDock 0.246.0・隔離Relay fixtureによる既存結合11群も成功。本体試験の画面選択はmanifestの表示名を参照する形へ更新した。本体の製品コード/版は変更せず、実利用先への配置は行っていない。
- update.zip SHA-256: `3de5dd3d42bc1bb22893e4cf36fdcd422a9470b11d52ba44819f0b3e5035d703`。manifest SHA-256: `689bf6bbaf7b238ce53723c6aa028e327fe61a7904d96308638e3df023e25d79`。index/processingの内容ハッシュは0.1.0と同じ。

## 2026-11-15 初回実装

- 個人CSV・最長一致の非再帰置換・Unicode/英単語境界・自然な文章分割・設定・宣言型補助画面・MCP受付handlerを実装。
- 固定Node 26.13.1による単体試験9件が成功。UTF-8/BOM/改行/引用符の往復、レコード位置の入力拒否、置換境界、グラフェム/URL/長語/置換語、12,000語の辞書と長文、排他的開始方式、プレビュー無通信、プレビュー後の原子的取り込み/競合を検査。証跡は`.artifacts/tests.log`。
- 本体0.246.0のreadManifestで宣言を読み込み、1モジュール/1ツールを検証。本体側の共通設定53件、型検査、main buildも成功した。
- 固定本体・実Applet・Relayの結合結果と発行ハッシュは以下に記録する。実サーバーと物理音声は未検証。

## 2026-11-15 発行と固定配布物の確認

- 0.1.0、minimumHostVersion 0.246.0を共通ヘルパーでローカル発行。製品入力コミット`73404e4`。publish内の単体9件、更新packの終了コード、manifest・update.json・ZIPの版/容量/SHA-256、全3項目とrepo原本を照合した。
- AppDock 0.246.0固定EXE、発行済み本Applet、Relay 0.3.0による11群が成功。共有スイッチと通常リセットの独立、CSV取り込み/編集OK/入力Esc復元と取消、無通信プレビュー、小数秒、明暗/1280・760幅、4入力と即時受付、OFF/切断/Applet無効化後の継続、3部分の順序/count=2/生成再生の重なり、再起動保存を確認。
- 一般/Codexの両入口と実Node/.NET/nativeのMCP提供、2ツールを1スイッチで制御、禁止API拒否/停止/再起動も同じ固定本体で確認。証跡は本体`.artifacts/speech-applet-20261115/phase6-fixed-providers.log`、profile=`applet-api-portable-1794744124957`、全体の[検証記録](../AppDock.at365/VERIFICATION.md)。専用fixture EXE/Runtimeを回収済み。

| 内容 | SHA-256 |
| --- | --- |
| extension.json | `fbc7c28f67ca28c7cff7ac6eb8c772c579eb4537e2f5415494fd439d29e8c9b5` |
| index.cjs | `eb3c853052f8fe990459a727f762c821fcbf250df25f3eb3bb57aa9633ffdf57` |
| src/processing.cjs | `be7707f745daf0e799f8c4793ba567dc705ef97153965d580183f6cf165d210a` |
| update.zip | `1be0156aa2d441c011514c6bc607092c17774745c1c048d1eb26b9ae5594e2d1` |

実サーバーの品質・物理音声と配布辞書は未確認。スターター/カタログ/実利用先へ追加せず、push/外部公開も行っていない。
