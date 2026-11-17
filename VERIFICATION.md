# 検証記録

## 2026-11-17 分割方式の既定値を文単位へ変更（0.12.1）

- manifest、設定の正規化、分割関数の省略時の値を`sentences`へ統一した。明示的に保存された`characters`は維持し、方式切替・指定文字設定・分割アルゴリズムは変更しない。発行済み0.12.0からの既定値変更で、設定/API/保存形式の追加はないため0.12.1へパッチ更新した。
- 発行前レビューで全3入口の既定値と保存値の優先、非表示項目の保持、指定文字方式の明示的な試験を確認し、未解決の指摘なし。`test.bat`と`publish.bat`内の各45件が成功。空の設定でもプレビュー・MCP snapshot・試聴が同じ文単位の結果になることを確認した。
- 発行済みSpeak 0.12.1と固定AppDock 0.259.0で画面12群・MCP結合11群が成功。初期選択と3項目の非表示、改行を含む文末での分割、指定文字への切替と再起動復元を確認した。画面profileは`.artifacts/dictionary-ui-1794911013338/`、結合profileは本体`.artifacts/applet-api-portable-1794911059147/`。画面の文単位表示も目視確認した。実サービスの品質と物理出力は対象外。
- feed/manifestと原本・展開済み配布物・ZIP全5項目、両固定試験の入力を照合した。ZIP SHA-256=`4c80591873acd085a5550fee22c6aa8e21852b2e0456f4e177374c41d3abfa82`、18,107 bytes。固定EXE SHA-256=`68b25cedd9ec53ecc8680b5c05cb548667e697d8b96d52e0ceb2957c2f8a245b`。証跡は`.artifacts/sentence-default-20261117/`の単体/発行/画面ログ、レビュー、`publication.json`。本体の実装変更はなく再発行しない。
- 古い成功の画面・結合profileを各1件整理し、各試験の直近3成功と開発版/失敗/不明分を保持した。参照プロセスと再解析ポイントの不在を確認し、結果は`cleanup.json`へ保存した。検査シェル自身の文字列参照で一度中断した検査は、自身だけを除いて再確認した。本体の文書/fixtureとは別のローカルコミットへまとめ、push・外部公開・実利用先配置は行わない。

## 2026-11-17 文単位方式の選択と連続区切り文字（0.12.0）

- `splitMode`へ指定文字方式（初期`characters`）と文単位方式（`sentences`）を追加した。後者は常駐`Intl.Segmenter("ja", { granularity: "sentence" })`で候補を取り、両方式とも目安の前後で最も近い境界、同距離なら手前を選ぶ。指定文字・改行・スペースの3設定は方式に応じて共通`visibleWhen`で表示し、非表示でも値を保持する。設定追加と必要ホスト版の引き上げにより0.12.0/最低AppDock 0.259.0。外部ライブラリ・MCP入力・CSV形式は変更しない。
- 既定文字を`.!?。！？．｡`へ変更し、読点・リーダーを除いた。連続する指定文字と後続の閉じ括弧は末尾だけを候補にする。発行前レビューで全角小数`３．１４`の途中を避ける保護を追加し、URL・辞書置換範囲・書記素・空白/改行保持と両方式を検証した。設定snapshot、分割後の前後文、プレビュー/試聴/MCPの共通処理に未解決の指摘なし。
- `test.bat`45件成功。両方式の最寄り/同距離・英日文末・保存済み指定文字を無視する文単位処理・連続記号/閉じ括弧・全角小数・保護範囲・設定拒否・全3入口の一致を確認した。`publish.bat`も同45件と梱包に成功。ログとレビューは`.artifacts/sentence-splitting-20261117/`の`unit.log`、`publish.log`、`prepublish-review.json`。
- 発行済みSpeakと固定AppDock 0.259.0による辞書画面12群、本体MCP結合11群が成功。画面ではキーボードでの方式変更、3項目の非表示と保存値保持、検索から方式への誘導、再起動復元、辞書と前後文の既存動作を確認し、両方式の画面を目視確認した。固定profileは`.artifacts/dictionary-ui-1794907812757/`。開発版の成功は`.artifacts/dictionary-ui-1794907444133/`に保持し、最終製品の判定には固定版を使用した。
- 結合profileは本体`.artifacts/applet-api-portable-1794907843042/`。空の指定文字設定を保持した文単位モードで実MCPから4部分の生成、各部分への前後文、count=2、受付時の接続設定保持、ローカル試聴と再起動を確認した。実音声サービスの品質・物理出力・Relay経路は対象外。本体の型検査と設定/provider関連490件も成功し、変更していない全機能の回帰は再実行していない。
- feed/manifestのID・版・必要ホスト版、原本・展開済み発行物・ZIPの全5ファイル、両固定試験の入力を照合した。ZIP SHA-256=`69144af123754b0c6cc50fb3d5be6e2d0865963ab79a546ff1819ba6e29cab42`、18,105 bytes。固定EXE SHA-256=`68b25cedd9ec53ecc8680b5c05cb548667e697d8b96d52e0ceb2957c2f8a245b`。同証跡フォルダーの`publication.json`、`validation-inputs.json`、`fixed-ui.log`、本体側`fixed-integration.log`に結果を保存した。
- プロセス終了・絶対パス・再解析ポイント不在を確認し、古い成功の画面1フォルダーと本体結合1フォルダーを整理した。方式ごとの直近3成功、失敗/不明分、共通ランタイムと固定build・配布物は保持した（`cleanup.json`）。本体の共通設定対応とは別のローカルコミットへまとめる。push・外部公開・実利用先配置は対象外。

## 2026-11-17 前処理を待たないMCP受信応答（0.11.0）

- `mcpToolModules`へ`responseMode: "accepted"`を宣言し、最低ホスト版を0.258.0に更新した。本体MCP入口で受信結果を返し、Applet handlerの配送・辞書準備/変換・分割・TTS登録を待たない。内部handlerは従来どおりTTS受付をawaitして準備の失敗を本体へ返し、受信後の最終失敗は本体が共通通知/ログへ報告する。公開4入力と`{accepted:true}`、辞書/分割/試聴の処理本体は維持する。最低ホスト版とmanifest契約の変更により0.11.0へマイナー更新した。
- 発行前に即時応答モードの宣言、内部受付との責務分離、受信時の通常設定snapshotと処理開始時の常駐辞書、接続不明時の非フォールバック、共通の失敗報告、期限/上限/再送の非追加をレビューし、未解決の指摘なし。案内と利用ガイドは受信だけの結果であることへ揃えた。
- 固定Node 26.13.1の単体43件とpublish内の同43件が成功。本体の関連51件・型検査と、発行済み本体0.258.0/Speak 0.11.0/Relay 0.3.1の結合12群も成功した。Appletの前処理待機を解除せず本体側の受信応答が返ることは本体の制御fixtureで検査し、実MCPでは不明接続の受信応答後のエラー通知、既存の4部分の生成/再生と設定保持・公開OFF/切断・試聴を確認した。実音声サービス品質・物理音声は対象外。
- 本体の対応実装は別作業を保つ専用worktree `AppDock.at365-speech-fast-receipt`で発行し、結合profileも同worktreeの`.artifacts/applet-api-portable-1794904783415/`へ保存した。ログ/レビュー/公開物照合は本repoの`.artifacts/fast-receipt-20261117/`および本体worktreeの同名フォルダーを参照する。
- 共通publishが成功し、更新feedの版/最低ホスト版/容量/SHA-256、ZIP全5項目、原本・展開済み発行物・結合試験入力を照合した。証跡は`.artifacts/fast-receipt-20261117/publication.json`。受信応答方式の変更と独立な大規模辞書画面回帰は再実行せず、単体と本体結合を適用範囲とした。commit・push・外部公開・実利用先配置は行っていない。

- その後のmain統合依頼により、対応本体の最終0.258.1を通常発行先へ発行し、mainの関連52件・型検査・固定MCP結合12群も成功した。本体main profile=`.artifacts/applet-api-portable-1794905451266/`。Speakの原本/発行ZIP/展開済み発行物/最終結合入力は一致し、版の追加変更は不要。`.artifacts/fast-receipt-20261117/publication-main.json`へ最終照合を保存し、今回の5ファイルをmainへローカルコミットする。push・外部公開・実利用先配置は行わない。

## 2026-11-17 指定した区切りのうち目安に最も近い位置で自動分割

- 0.10.0、minimumHostVersion 0.249.6。`splitCharacters`（初期`。.`）、`splitOnNewline`（初期true）、`splitOnSpace`（初期false）を通常設定・自動分割Section・MCP設定snapshotへ追加した。各部分の目安位置から前後で最も近い候補を選び、同距離は手前にする。文字種の優先順位と0.6〜1.4倍の探索範囲、任意の文中位置への分割を廃止し、候補なしは残り全文、残りが目安以下なら最後の1部分にする。読点は初期の対象に含めない。設定追加と意図した動作変更によりマイナー更新した。
- 発行前に候補列挙と距離比較、閉じ括弧の付与、書記素/URL/小数/英単語/辞書範囲の保護、空白だけの部分を作らない全文保全、初期値、設定検証、共通processorとMCP設定キー、公開4入力/accepted応答・CSV/保存ファイル・本体APIへの非影響をレビューした。末尾に長い空白だけが残った場合を直前の部分へ保持し、対応する境界試験も追加。未解決の指摘なし。レビュー記録は`.artifacts/nearest-splitting-20261117/prepublish-review.json`。
- 固定Node 26.13.1で単体43件とpublish内の同43件が成功。前後双方/探索距離制限なし/同距離/改行と句点の同順位、読点とスペースの既定除外、任意文字と絵文字の指定、改行とスペースの独立切替、全候補OFF、長い末尾空白、閉じ括弧/保護範囲、不正な設定を確認した。設定切替後のプレビュー/MCP/試聴は同じsegmentsで、Storage再読込なし。ログは同フォルダーの`unit.log`と`publish.log`。
- 発行済みSpeakと固定AppDock 0.257.2・共通ランタイムによる辞書画面11群、本体結合11群が成功。新3項目の初期値・編集・保存・再起動復元、読点追加と同距離の手前選択、スペースON/OFF・改行のみ・全候補OFFのプレビューを確認した。既存の前後文追加/辞書/共有・PC専用、実MCPの4部分の生成順/受付時設定の保持、ローカル試聴も成功。画面profile=`.artifacts/dictionary-ui-1794900208368/`、結合profile=本体`.artifacts/applet-api-portable-1794900259599/`。実音声サービスの品質・物理出力は検証対象外。
- コマンドは`test.bat`、`publish.bat`、本体の`dev.bat exec node ../Applet.Speak.at365/scripts/dictionary-ui-test.cjs <固定EXE> <発行Applet>`、`APPDOCK_TEST_SPEAK_APPLET=<発行Applet>`を指定した本体`dev.bat exec node scripts/applet-api-ui-test.cjs <固定EXE>`。固定EXE SHA-256=`e72a1b7fb0dd54d08bf8af71b2180bcaa7ac3bdef18ec9627af21af59ba4ed9f`。通常の本体コピーは作らず、結合fixtureのnative実行物は既存cleanupで回収した。依存検査は通常のWindowsユーザー環境で実行し、lockfile/固定ツールを維持した。
- 共通ヘルパーで解決したローカル発行先のfeed/manifestのID・版・最低本体版、ZIP容量/SHA-256、全5項目の原本・展開済み発行物・ZIP・両固定試験入力を照合した。ZIP SHA-256=`9368b444e4eb1bcd7dc15b13a24da128a4fc06c6917eec16fba0195f7eb2e736`、容量17,663 bytes。証跡は`.artifacts/nearest-splitting-20261117/publication.json`、`fixed-ui.log`、`fixed-integration.log`。本体の変更は分割仕様文書だけで、製品コード・版・本体publishは変更しない。未変更の辞書エンジン/保存/依存の性能測定と本体全回帰は再実行しない。
- プロセス終了・絶対パス・再解析ポイント不在を確認し、古い成功の画面1フォルダーと本体結合2フォルダーを整理した。各方式の直近3成功、失敗/不明分、共通ランタイム・固定build・発行物は保持し、今回のprofile参照プロセスは0。削除名/旧結果JSON/ハッシュは同フォルダーの`cleanup.json`へ保存した。コミット・push・外部公開・実利用先配置は行っていない。
- コミット依頼時に製品5ファイル、テスト/fixture/補助スクリプト/固定ツール定義9ファイル、発行ZIP/feed、固定EXEと両試験入力のSHA-256を再照合し、すべて実装時の成功対象と一致した。後続の差分は文書・検証記録だけのため、単体43件・画面11群・MCP結合11群を再利用し、製品の再発行や無関係な回帰は行わない。今回の8ファイルと、本体側の関連文書2ファイルをそれぞれローカルコミット対象とする。照合結果・stage/commit treeは同フォルダーの`commit-validation.json`へ記録する。push・外部公開・実利用先配置は対象外。

## 2026-11-17 公開版索引とRelease（0.9.0）

- 同版のソース・発行済みZIPの全収録ファイル、ID/版/最低本体版、サイズ/SHA256と標準単体回帰を確認。製品コード・版・配布物は変更せず、既存同版のReleaseは再作成しない。
- 正式Releaseの匿名feed/ZIP取得とタグ固定元の実更新確認が成功。公開版索引を追加し、ZIP取得先を同じrepoの固定タグへ限定した。
- 公開先は[v0.9.0](https://github.com/yukichi-7sai/Applet.Speak.at365/releases/tag/v0.9.0)。raw索引の確認と旧Release整理の実行結果は`.artifacts/release-repository-feed-20261117/receipt.json`と同フォルダーの整理結果へ保存する。

## 2026-11-16 前後文を分割前または各部分の分割後へ追加

- 0.9.0、minimumHostVersion 0.249.6。通常設定`additionTiming`へ`before-split`（分割前に追加する、初期値）と`after-split`（分割後に各部分へ追加する）を追加した。前者は従来どおり全体へ1回ずつ追加して辞書変換・分割する。後者は本文を辞書変換・分割し、別に一度だけ変換した前後文を全ての部分へ付け、再分割しない。設定追加のためマイナー更新した。公開MCPの4入力/accepted応答、本文必須、本体/RelayのAPIとCSV形式は維持する。
- 発行前レビューで既定値による従来動作の保持、設定snapshot、処理順、置換範囲を保つ本文分割、一度だけの辞書変換、全部分への追加、空欄/空白/改行設定、最終全文と各部分のプレビュー、試聴との共通処理を確認した。分割後は前後文と本文の境界をまたぐ照合を行わず、分割目安は本文へ適用する。長い前後文で部分数を増やさない仕様を選択欄とガイドへ明記し、未解決の指摘なし。
- 固定Node 26.13.1で単体38件、publish内でも同38件が成功。3部分すべてへの追加、変換結果を再置換しないこと、長い追加文の非再分割、分割/辞書変換OFF、空欄/空白/入力内改行、不正な列挙値、元の本文/ニュアンス保持を検査した。プレビュー更新・MCP・試聴で同じ最終segmentsを使い、設定変更や連続処理でもStorageを読まない。ログは`.artifacts/addition-timing-unit-20261116.log`、`addition-timing-publish-20261116.log`。
- 発行済みSpeakと固定AppDock 0.250.2で辞書画面10群、本体結合11群が成功。初期の分割前から分割後への切替、前後の辞書変換と3部分の表示、分割前へ戻した結果、分割後設定の保存/ホスト再起動後の復元、改行4通りと空欄への復元を確認した。既存の1万語の仮想テーブル/検索と編集、10万件の配布CSV・優先順・再取り込み・共有/PC専用の検査も成功。実MCPの3つの本文すべてへ辞書変換済みの前後文が付き、3つのTTS要求の順序、count=2での再生開始と3つ目の生成の重なり、単一のホストjobを確認した。実音声サービス品質と物理音声は対象外。
- 画面profile=`.artifacts/dictionary-ui-1794829648854/`、ログ=`addition-timing-fixed-ui-20261116.log`。本体結合profile=`applet-api-portable-1794829625733/`、ログは本体の`.artifacts/addition-timing-fixed-integration-20261116.log`。固定EXE SHA-256=`bffc5a7a481b93043848e9bdcdf00be38a49890b94efd40b74a27c7892e5e3ce`。本体`dev.bat exec node`から本repoの`scripts/dictionary-ui-test.cjs <固定EXE> <発行Applet>`、本体の`scripts/applet-api-ui-test.cjs <固定EXE>`（`APPDOCK_TEST_SPEAK_APPLET`を指定）を共通ランタイム・隔離profileで直列実行した。専用EXEコピーは作っていない。
- 共通publishで更新feed/ZIPを発行し、版/最低ホスト版/容量/SHA-256と、ZIP全5項目・原本・展開済み発行物・両固定試験の入力ハッシュを照合した。ZIP SHA-256=`eb67e926066e7a1fce1ba05d9bb5cbfbdd94a7b7ddd949edb36af537dcc9dc72`。証跡は`.artifacts/addition-timing-publication-20261116.json`。辞書エンジン/Storage/依存は本件で変更していないためメモリ測定と本体全回帰は再実行しない。以後は記録追記のみで、上記の成功をコミットに再利用する。本件の本体変更は設計書と結合fixtureだけで、既存の別作業の変更とステージ状態を保持する。
- 成功後にプロセス参照と再解析ポイントを確認し、古い成功の辞書画面3フォルダー（`dictionary-ui-1794808570907/`、`dictionary-ui-1794807976423/`、`dictionary-ui-1794786599043/`）と本体結合1フォルダー（`applet-api-portable-1794786576662/`）を整理した。各方式の直近3成功、失敗/不明分、共通ランタイム・固定build・発行物を保持し、保留/失敗0件。旧結果JSON/ハッシュは`.artifacts/addition-timing-cleanup-20261116.json`に保存した。push・外部公開・実利用先配置は行っていない。

## 2026-11-16 ページのないユーザー辞書と共通仮想テーブル

- Speak 0.8.0、minimumHostVersion 0.249.6。ユーザー辞書の100件ページ・表示範囲パネル・前後ページactionとページ状態を廃止し、全行を1つの共通テーブルへ渡す。配布辞書の優先順説明パネルも除去し、優先順の列と並べ替え操作を保持した。CSV形式・行ID・重複解決・辞書の常駐・MCPは変更しない。共通仮想表示を使う最低ホスト版の引き上げによりマイナー更新した。
- 本体0.249.6で共通provider一覧の仮想表示/全件検索を導入し、目視で見つけた長い読みの横伸びを既存の折り返しクラスで修正して0.249.7を発行した。通常の一覧は従来の描画を使い、provider一覧が200行を超える場合だけ画面付近とフォーカス行を描く。200は方式切り替えの閾値で、件数上限ではない。ページの既存スクロール枠、ネイティブtable/行/ボタン、全件数と行位置のARIA、検索後の元の行index/IDを維持する。
- 行高さをResizeObserverで実測し、推定値と測定差分の累積木で位置を求める。スクロールごとの全行走査を避け、折り返し・幅変更時の行位置を調整する。フォーカス中の行を保持し、Tab/Shift+Tabで未描画の隣接行へ移動してからフォーカスする。元データ全体の受信/検査・CSV保存・全件検索は件数に比例する処理であり、描画行数の削減と区別する。スクリーンリーダー実機での検証は未実施。
- 発行前レビューで保存/API非変更、削除対象Section、優先順と行ID、検索後の編集/削除index、空/小規模一覧、既存の単一スクロール、可変高・フォーカス・aria-hiddenの対象を確認した。最初の型検査でrefの初期値不足を修正した。初回の発行物では長い読みがnowrapになる既存スタイルを目視で確認し、共通の折り返しを適用して150pxを超える実測行の検査を追加した。未解決の指摘なし。
- Speak単体35件とpublish内の35件、本体のprovider/一覧/容量方針/翻訳/仮想行位置の関連39件、型検査と本体発行が成功。位置計算は10万行に異なる高さを加えて独立した配列の累積値/行探索と照合した。ログは本repo`.artifacts/full-table-unit-20261116.log`、`full-table-publish-20261116.log`と分離した本体checkoutの`.artifacts/related-tests-20261116.log`、`typecheck-final-20261116.log`、`publish-final-20261116.log`。折り返し修正は高さ計算/APIに影響しないため39件を再利用し、GUIを最終発行物で再実行した。
- 開発ビルドの1万件9群が成功した後、最終発行物でユーザー辞書10万件の9群、共通設定13群、MCP/試聴11群が成功。10万件でも初期DOMの実データ行は13行で、末尾へのスクロール、狭幅で長い読みの実際の折り返し、全件検索した行の編集、Tab/Shift+Tab境界移動、renderer例外なしを確認した。取り込み開始から末尾移動・検索・編集保存までの一連の操作は11,548msで、初期描画時間/検索単体時間ではない。CSVのBOM/改行/書出・共有/PC専用・優先順・再取り込み・ケース設定・前後文・ホスト再起動も維持する。
- 最終profileは本repo`dictionary-ui-1794809064959/`、本体`settings-controls-ui-1794809100273/`、`applet-api-portable-1794809114081/`。ログは`full-table-fixed-ui-final-20261116.log`、本体の`speak-table-settings-controls-final-20261116.log`と`speak-table-fixed-integration-final-20261116.log`。再現は`APPDOCK_TEST_USER_WORDS=100000`を指定して従来の辞書画面試験を実行する。共通設定回帰の初回は廃止済み「操作の許可」へのリンクを待つ古い検査で失敗したため、現行のMCPツール公開画面への遷移を同じ検査に置き換え、最終版でも全13群を確認した。失敗profile/logも保持する。
- 同時進行中の本体変更を保持するため、mainの今回の対象ファイルだけを分離checkout`AppDock.at365-speak-table`へ複写して発行した。通常の本体発行先は更新せず、分離した発行先と通常のSpeak発行先を照合した。固定EXE SHA-256=`76f727764ed4c32dce1e85c6365e52370228e42541851d46b1a26f76ba50b44f`。本体ZIP全131ファイルとbuild原本/発行先、Speak ZIP全5ファイルと原本/発行先/最終GUI入力、feedの版/容量/SHA-256、およびmainと分離checkoutの対象ファイル一致を検証。証跡は`.artifacts/full-table-publication-final-20261116.json`。本体ZIP=`2bb393a51c9a061e11f939ff2981e827bf8249e9c6c62fa87e583333aebacaf0`、Speak ZIP=`234d84dc56f95c87ae325a785594e326fc94111fd1ba878cec0f966ba8769535`。分離checkoutの最初のツール参照不足は固定ツールの絶対参照を揃えて回復し、lockfile/依存検査を維持した。
- 完了後にプロセス参照・対象パス・再解析ポイントを確認し、古い成功の辞書画面2件・本体結合2件・共通設定2件を整理した。方式別の直近3成功（3回未満は全成功）、失敗/不明分、共通ランタイム・固定build・発行物・分離checkoutを保持し、保留/失敗0件。削除名/旧結果JSON/ハッシュは`.artifacts/full-table-cleanup-20261116.json`。分離checkoutは利用者管理のため削除しない。以後の文書/記録追記は製品に影響せず、成功結果をコミットへ再利用する。push・外部公開・実利用先配置は行っていない。

## 2026-11-16 設定画面からの試聴

- 0.7.1、minimumHostVersion 0.249.0。「設定」タブの補助操作へ「試聴」を追加した。共通ダイアログで文章と既定/登録済み音声接続を選び、現在の前後文・改行・辞書変換・自動分割・再生開始設定で読み上げる。声/話し方は選んだ接続の設定を使う。本文/接続選択を設定へ保存せず、受付後も入力を残して試し直せる。MCP公開OFFでも利用できる。
- 既存の`tts.connections.list`と`tts.sequences.speak`をローカルのread/execute actionから利用し、本体/SDK/Runtime/Relayの製品コード・公開API、MCPの4入力/accepted応答、通常設定・保存形式は変更していない。内部の設定補助操作と共通UIの追加としてパッチ更新した。「文章プレビュー」は引き続き通信/音声生成/再生を行わない。試聴を開く/取消するだけでも音声を送信しない。
- 発行前レビューで選択接続と既定接続の分離、本文と設定の保持、共通の常駐辞書/処理順、execute認可と候補取得後の取消、未知接続・受付失敗時の非フォールバック/非再試行、MCPとの境界、受付後に追加通信せず入力を戻すことを確認した。接続未登録時の案内/実行無効化と、辞書未読込時の入力エラーを用意し、未解決の指摘なし。共通ダイアログの表示は結合profileの`audition.png`で目視確認した。
- 固定Nodeの単体35件とpublish内の同35件が成功。開くだけでは音声なし、接続候補と明示/既定の使い分け、現在設定とプレビューの一致、変換後の分割・開始方針、ホスト受付前に応答しないこと、受付後の入力保持、辞書再読込/CSV書込なし、空の本文・未登録/未知接続・認可取消・候補取得中の取消・外部MCP actorの拒否を確認した。ホスト受付のNOT_FOUNDは1回だけ呼び出してそのまま失敗させる。ログは`.artifacts/audition-unit-20261116.log`、`audition-publish-20261116.log`。
- 原本と固定AppDock 0.249.3で結合11群、発行済みSpeakと同固定EXEで結合11群・辞書画面8群が成功した。MCP公開OFFの設定画面から試聴し、既定とは別の接続へ`アップドック改!試聴です。!アップドック改`を複数部分で送り、選んだ声`audition-voice`/話し方`gentle audition`でモックTTSが受信することを確認。受付後も入力を保持し、ダイアログを閉じた後も本体の音声キューで1ジョブが完了する。既定接続・CSV・公開OFFの保持、既存MCPの分割/公開切替/再起動と10万件の辞書操作も成功。実外部TTSの生成品質と物理音声はfixtureの検証対象外。
- 原本結合profile=`applet-api-portable-1794786466025/`、発行物結合=`applet-api-portable-1794786576662/`、辞書画面=`dictionary-ui-1794786599043/`。ログは本体`.artifacts/audition-source-integration-20261116.log`、`audition-fixed-integration-20261116.log`と本repo`.artifacts/audition-fixed-ui-20261116.log`。実行は前項と同じ共通ランタイム・隔離profile方式で直列に行い、専用EXEコピーは作っていない。固定EXE SHA-256=`f0dc6ccc413f5b5119277df68df1ed4c2377368b61dde61bdef75f7668c7690a`。
- 共通publishが成功し、feedの版/最低ホスト版/容量/SHA-256、ZIP全5項目と原本/発行先/3回の固定試験の入力ハッシュを照合した。ZIP SHA-256=`33d7bd0b69338f1a7396cf8d4479e8eb6709fe6b0fc0636b687283508efdfbfd`。証跡は`.artifacts/audition-publication-20261116.json`。辞書エンジン/Storage/依存の変更はなく、メモリ測定と本体全回帰は再実行しない。成功後の変更は利用ガイドの保存範囲/受付後の説明と検証記録のみで、上記成功をコミットへ再利用する。本体の本件差分は設計書/結合fixtureのみとし、別作業の変更を保持した。push・外部公開・実利用先配置は行っていない。
- 成功後、通常ユーザー環境でプロセス参照・パス・再解析ポイントを確認し、古い成功`dictionary-ui-1794780802346/`、本体の`applet-api-portable-1794781360953/`と`applet-api-portable-1794778700728/`を整理した。各方式の直近3成功、失敗/不明分、共通ランタイム・固定build・発行物を保持し、保留/失敗0件。旧結果JSON/ハッシュと削除結果は`.artifacts/audition-cleanup-20261116.json`に保存した。

## 2026-11-16 前後文の改行を個別に選択

- 0.7.0、minimumHostVersion 0.249.0。「前の文章の後に改行を入れる」`prefixNewline`と「後の文章の前に改行を入れる」`suffixNewline`を通常設定へ追加した。両方初期trueで、設定がない場合も従来どおり改行する。OFF側は空白/区切りを足さずに直接結合し、入力した文章自体の空白・改行は保持する。空白だけの前後文は設定にかかわらず追加しない。設定追加のためマイナー更新した。
- 発行前レビューで初期値とboolean検証、前後の独立した4通り、空欄と入力の改行保持、結合後の辞書変換/分割、MCP自己設定snapshot、プレビューとの共通処理、既存の辞書常駐を確認し、未解決の指摘なし。公開MCPの4入力/accepted応答、本体/RelayのAPIと保存ファイルの形式は維持する。
- 固定Node 26.13.1で単体32件、publish内でも同32件が成功。4通りの変換/分割結果、改行OFFで境界をまたいで完成する`keyboard`の辞書照合、入力の空白/内部改行保持、空欄、型不正、プレビュー再更新とMCPの一致、連続処理で辞書を再読込しないことを検証した。ログは`.artifacts/addition-newlines-unit-20261116.log`、`addition-newlines-publish-20261116.log`。
- 発行済みSpeakと固定AppDock 0.249.3で辞書画面8群、本体結合10群が成功。設定の初期ON、4通りのプレビュー、両方OFFの保存とホスト再起動後の復元、空欄/空白だけへの変更、CSV原文保全を確認した。実MCPからは改行OFFの前後文を辞書変換した`アップドック改!Silent fixture!アップドック改`がモックTTSへ届き、`instructions: gentle`は別に保持する。受付後の設定変更/公開OFF/切断/提供Applet停止でも確定済み計画が1回だけ継続する。実サーバー品質と物理音声は対象外。
- 画面profile=`.artifacts/dictionary-ui-1794784448918/`、ログ=`addition-newlines-fixed-ui-20261116.log`。本体結合profile=`applet-api-portable-1794784430288/`、ログは本体の`.artifacts/addition-newlines-fixed-integration-20261116.log`。固定EXE SHA-256=`f0dc6ccc413f5b5119277df68df1ed4c2377368b61dde61bdef75f7668c7690a`。実行コマンドは前項と同じ共通ランタイム方式で、発行済みAppletを入力にして直列に検証した。専用EXEコピーは作っていない。
- 共通publishで更新feed/ZIPを発行し、版/最低ホスト版/容量/SHA-256、ZIP全5項目・原本・展開済み発行物・両固定試験の入力ハッシュを照合した。ZIP SHA-256=`1acc05d16b99a1c69371385e84619e277c799107e9244bdc303d9692975e8b21`。証跡は`.artifacts/addition-newlines-publication-20261116.json`。辞書エンジン/Storage/依存は本件で変更しておらず、メモリ測定と本体全回帰は再実行しない。製品/試験の後続変更はなく、記録追記とコミットに上記の成功を再利用する。本件の本体差分は設計書と結合fixtureのみで、既存の別作業の変更を保持した。
- 成功後に通常ユーザー環境でプロセス参照と再解析ポイントを確認し、古い成功`dictionary-ui-1794778718077/`と本体の`applet-api-portable-1794764939239/`を整理した。各方式の直近3成功、失敗/不明分、共通ランタイム・固定build・発行物は保持し、保留/失敗0件。旧結果JSON/ハッシュは`.artifacts/addition-newlines-cleanup-20261116.json`へ保存した。push・外部公開・実利用先配置は行っていない。

## 2026-11-16 読み上げの前後に文章を追加

- 0.6.0、minimumHostVersion 0.249.0。通常設定へ`prefixText`/`suffixText`（前に付ける文章/後に付ける文章、初期値は空文字）を追加した。空欄・空白や改行だけの項目は除き、前文・元の本文・後文を改行1つで結合してから辞書変換・自動分割する。辞書変換/分割がOFFでも追加する。MCP本文の必須条件、4入力、`instructions`、accepted応答と本体/RelayのAPIは維持する。設定追加のためマイナー更新した。
- 発行前レビューで追加位置と処理順、文字列型/空欄の扱い、元の本文/非空項目の空白保持、設定snapshot、辞書の置換範囲を保つ分割、プレビュー再更新時の重複防止、共有の設定部品、配布対象を確認した。プレビューは入力へ元の本文、出力へ前後文を含む全体を表示する。独自の設定UI・保存ファイル・待機期限は追加せず、未解決の指摘なし。
- 変更前の回帰失敗を保存し、固定Node 26.13.1で単体31件、publish内でも同31件が成功。前後文への辞書変換と分割、置換語の途中を切らないこと、空欄/空白だけ/片側だけ/内部改行、辞書変換と分割のOFF、本文/ニュアンスの保持、プレビュー再更新、連続処理でStorageを読まないことを確認した。ログは`.artifacts/text-additions-before-20261116.log`、`text-additions-unit-final-20261116.log`、`text-additions-publish-20261116.log`。
- 開発原本と固定AppDock 0.249.2で辞書画面8群、発行済みSpeakと同固定EXEで辞書画面8群・本体結合10群が成功。前後文の保存/ホスト再起動/空白/クリア、全体の辞書プレビュー、CSV原文保全、既存の10万件取り込み・優先順・再取り込み・共有/PC専用・明暗/狭幅を確認した。発行物ではMCP本文`Silent fixture`へ前後の`AppDock`を追加し、TTSへ`アップドック改\nSilent fixture\nアップドック改`と別の`instructions: gentle`が届くことを検査。受付後の前後設定クリア・公開OFF・切断・Applet停止でも、確定済みの同じ読み上げを再試行せず継続する。実サーバー品質/物理音声はfixtureの対象外。
- 画面ログは`.artifacts/text-additions-source-ui-20261116.log`、`text-additions-fixed-ui-20261116.log`、本体の`text-additions-fixed-integration-20261116.log`。画面profileは`dictionary-ui-1794780802346/`（原本）と`dictionary-ui-1794781378389/`（発行物）、本体結合は`applet-api-portable-1794781360953/`。固定EXE SHA-256=`52237d0daa9de5b45baecdc7b8aea88275dce5ba94931d88b369eccb76ffde19`。再現は本体`dev.bat exec node`から本repoの`scripts/dictionary-ui-test.cjs <固定EXE> <Speakの原本または発行Applet>`、本体の`scripts/applet-api-ui-test.cjs <固定EXE>`（`APPDOCK_TEST_SPEAK_APPLET`に発行Appletを指定）を直列に実行する。
- 共通publishの成功後、feedの版/最低ホスト版/容量/SHA-256と、ZIP全5項目・repo原本・展開済み発行物を照合した。ZIP SHA-256=`f96d4067ade3f6d18a09bef3ea560c76f98a66ffc25e50fcc251eba030b3756b`。各試験の5入力ハッシュも発行物と一致し、証跡は`.artifacts/text-additions-publication-20261116.json`。辞書エンジン/保存モジュールと依存を変更していないため前項のメモリ測定は再実行せず、今回の単体/結合/画面の成功は以後の記録追記とコミットに再利用する。本体製品の再発行、push・外部公開・実利用先配置は行っていない。
- 終了後に通常ユーザー環境でプロセス参照と対象/配下の再解析ポイントを検査し、古い成功の`dictionary-ui-1794778469069/`、`dictionary-ui-1794776497597/`と本体の`applet-api-portable-1794763889567/`を整理した。各方式の直近3成功、失敗/不明分、共通ランタイム・固定build・発行物は保持。旧結果JSON/ハッシュと削除結果は`.artifacts/text-additions-cleanup-20261116.json`に保存し、保留/失敗0件。

## 2026-11-16 辞書変換の大小文字設定

- 0.5.0、minimumHostVersion 0.249.0。「自動置き換え」を「辞書変換」へ改称し、`dictionaryIgnoreCase`（英字の大文字・小文字を区別しない、初期true）を追加した。ONは半角英字A–Z/a–zを同一視し、OFFは元の表記に一致する登録を使う。単語境界・最長一致・置換結果の非再置換・CSV原文/形式を維持する。設定追加のためマイナー更新し、本体/SDK/Runtimeの追加変更はない。
- 発行前レビューでASCII同一視とUnicode/UTF-16位置、大小文字衝突の優先順位、入力行から独立した索引、空/長い語、MCP設定snapshotと初期値、保存範囲/再起動、配布対象を確認した。1本の連続配列型トライに元の表記範囲と優先置換先を保持し、区別する場合の複数表記は二分探索する。設定変更でファイルを読み直さず、索引を再構築しない。未解決の指摘なし。
- 変更前の不一致を再現した後、固定Node 26.13.1の単体28件とpublish内の同28件が成功。独立した逐次比較による100組×両方式の結果/範囲、同じ語の256表記、大小文字の違う登録間のユーザー優先/配布順、Unicode・長い語・10万語、プレビューとMCPの初期値/ON/OFF/再読込なしを検証。ログは`.artifacts/case-conversion-before-20261116.log`、`case-conversion-unit-final-20261116.log`、`case-conversion-publish-20261116.log`。
- 開発原本と固定AppDock 0.249.2で辞書画面7群、発行済みSpeakと同固定EXEで既存結合10群・辞書画面7群が成功。新セクションと初期ON、即時切り替え、OFF保存後のホスト再起動、再度ON、未登録の`keyboard`や英単語内の保護、CSV原文/辞書順序/共有・PC専用/明暗と狭幅を確認した。発行済み辞書画面profile=`.artifacts/dictionary-ui-1794778718077/`、本体結合profile=`applet-api-portable-1794778700728/`。ログは`case-conversion-source-ui-20261116.log`、`case-conversion-fixed-ui-20261116.log`と本体の`case-conversion-fixed-integration-20261116.log`。固定EXE SHA-256=`52237d0daa9de5b45baecdc7b8aea88275dce5ba94931d88b369eccb76ffde19`。
- 指定されたBEP由来の辞書とユーザー辞書を読み取り専用で読み、`Hello`/`Python`/`JavaScript`/`English`がONでは登録された読みに、OFFでは元の表記になることを照合した。`keyboard`は両方で未置換、`key`と`board`はそれぞれ変換される。利用者のファイルは変更していない。証跡は`.artifacts/case-conversion-bep-20261116.log`。
- 2つの実CSVを使う合成データの別プロセス測定で、CSV/編集用行/両方式を使える索引の保持増分（ヒープ+ArrayBuffer）は5万件27.91MiB、10万件55.59MiB。10万件の準備705.001ms、1万文字の処理中央値0.273ms。230回の設定切り替え/処理後も読込5回・索引世代1のまま。Node全体RSS 227.82MiB、fixture作成等も含むピーク534.19MiBは保持量と区別する。ホスト/renderer/IPC/TTSを含む全体測定ではない。証跡は`.artifacts/case-conversion-benchmark-20261116/report.json`。
- 更新feedの版/最低ホスト版/容量/SHA-256、ZIP全5項目、repo原本と展開済み発行物を照合した。ZIP SHA-256=`f85c7909073ffbb72943fb313245138e59801893aa2f07c19e7a0b40f28cffd8`。証跡は`.artifacts/case-conversion-publication-20261116.json`。制限環境の初回pullはDNSで失敗したが、通常環境で再実行して最新を確認した。push・外部公開・実利用先配置は行っていない。
- 全試験終了後、プロセス参照と再解析ポイントを確認し、古い成功の辞書画面2フォルダー・本体結合1フォルダーを整理。各方式の直近3成功、失敗記録、共通ランタイム、固定build、発行先を保持した。削除名/旧結果/ハッシュは`.artifacts/case-conversion-cleanup-20261116.json`に記録した。

## 2026-11-16 重複CSVの取り込み

- 0.4.1。CSV内に同じ置換元が複数あっても拒否せず、先のレコードを採用するよう修正。重複を含むCSV原文を保存し、プレビュー・件数・検索索引は採用行から作る。ユーザー最優先/配布辞書の上段優先は維持する。手動の単語追加/編集は既存語の重複を入力エラーとし、列数・空白だけの値・不正な引用符は重複行でも検証する。
- 変更前は新規3件で不具合を再現し、既存21件は成功。修正後とpublish内では単体24件が成功した。読みの異なる重複、同内容の重複、BOM/CRLF/引用符内改行、大小文字と空白の区別、CSV原文保全、プレビュー、再読み込み/再取り込み、ユーザー辞書優先を検査。ログは`.artifacts/duplicate-csv-before-20261116.log`、`duplicate-csv-unit-20261116.log`、`duplicate-csv-publish-20261116.log`。
- 発行前に先頭優先の解決位置、全行の形式検証、行ID/件数/原文と索引の分離、編集時の重複拒否、公開MCP/保存形式への影響をレビューした。製品変更はCSV読込と版だけで、未解決の指摘なし。利用ガイド・辞書設計・本体側CSV仕様を同じ先頭優先へ揃えた。
- 移動後の`A:\005.LUNA`配下で発行済みSpeakと固定AppDock 0.249.2による辞書画面6群が成功。2つの配布CSVは計100,008レコードを含み、CSVごとの採用語数は合計100,004件。ユーザーCSVは251レコードから250語を表示する。ファイル指定による取り込み、原文コピー/書出、先頭/末尾の重複語の読み、ユーザー優先、順序/有効状態、再取り込み、外部不正CSVからの復旧、共有/PC専用とホスト再起動を確認した。成功profile=`.artifacts/dictionary-ui-1794776497597/`、ログ=`duplicate-csv-fixed-ui-rerun-20261116.log`。固定EXE SHA-256=`52237d0daa9de5b45baecdc7b8aea88275dce5ba94931d88b369eccb76ffde19`。
- 画面試験初回は書出ファイルの作成を保存完了として扱い、書込中の空ファイルを検査して失敗した。終了後には原文と完全一致したため試験の待機条件を内容全体の保存完了へ修正し、期待内容を保って再実行した。初回ログ`duplicate-csv-fixed-ui-20261116.log`と失敗profile=`.artifacts/dictionary-ui-1794776432441/`も保持する。
- 共通publishで移動後の発行先へ配置し、更新feed/ZIPの版・最低ホスト版・容量・SHA-256、および全5項目とrepo原本/展開済みファイルを照合した。ZIP SHA-256=`5f29fb67cf11ea7fb1a2cd009c73016ba96741108fcb1181512a45506711c3e0`。証跡は`.artifacts/duplicate-csv-publication-20261116.json`。本体製品の変更/再発行、push・外部公開・実利用先配置は行っていない。

## 2026-11-16 CSV原本と複数辞書管理

- 0.4.0、minimumHostVersion 0.249.0。ユーザー辞書も含め本文をファイルStorageの2列CSVへ分離。通常設定の`dictionary`とMCP snapshotから本文を除去し、既存Settingsの辞書は使用・移行しない。手動取り込み・配布辞書の有効状態/優先順/名称/再取り込み/削除、共通テーブルと編集ダイアログを追加した。公開MCPの4入力・accepted応答は維持する。設定/保存ファイルの追加削除と最低ホスト版変更によりマイナー更新した。
- 発行前レビューで保存原本、共有/PC専用の独立、MCP時の常駐索引、許可/取消/競合、失敗時の旧索引保全、削除範囲、配布対象を確認した。操作認可中のscope切替を再照合し、無効辞書の本文を解放しても外部変更を削除しないよう管理情報にbyte revisionを保持する修正を加えた。対応する拒否・再起動後の外部変更保護も単体で確認し、未解決の指摘なし。
- 固定Node 26.13.1の単体21件が成功。ユーザー最優先/上段優先、単語編集/CSV往復/不正入力、保存失敗/競合/古い画面、scope切替、名称だけの更新で索引を再利用すること、外部変更したコピーの保護、無関係な設定変更と連続MCP呼出しでファイルを読まないことを確認。ログは`.artifacts/csv-dictionaries-tests-final-20261116.log`。
- 固定AppDock 0.249.0と開発原本による既存結合10群、および`dictionary-ui-test.cjs`の6群が成功。後者は250件のユーザー辞書のページ表示/原文書出、計100,004件の配布CSVを実ファイル選択で取り込み、最初/最後の語・優先順・ON/OFF・再取り込み・削除・不正外部CSVからの復旧・同値設定の共有/PC専用切替・ホスト再起動・明暗/狭幅を検査。画面試験の初回失敗は共通UIの選択子（再読み込みの操作元、checkbox/radio、空表の案内行、切替ボタン名）による試験不備で、製品の期待値を弱めず修正した。失敗ログ/profileと最終成功profile=`.artifacts/dictionary-ui-1794764784187/`を保持する。
- 2つの実CSVとユーザー上書きを読む合成データの別プロセス測定で、辞書全体の保持増分（ヒープ+ArrayBuffer）は5万件26.94MiB、10万件53.57MiB。10万件の準備637.164ms、1万文字の処理中央値0.237ms。230回の処理で読込は初期5回のまま、索引世代も1のままだった。Node全体RSS 229.29MiB、fixture作成等を含むピーク497.66MiBは保持増分と区別する。ホスト/renderer/IPC/TTSを含む全体測定ではない。証跡は`.artifacts/csv-store-benchmark-20261116/report.json`。
- 共通publish内の同21件が成功。発行済みSpeakと固定AppDock 0.249.0で既存結合10群・辞書画面6群も再実行して成功した。発行済みの全5ファイル、ZIPの全5項目、repo原本とfeedの版/最低ホスト版/容量/SHA-256を照合。ZIP SHA-256=`a4be395ae96cd1da87ed2e80cf4394ec214840243a27f830b823dc72fcd162cb`。証跡は`.artifacts/csv-dictionaries-publication-20261116.json`、publish/fixed-uiログ、固定辞書profile=`.artifacts/dictionary-ui-1794764955840/`、本体のfixed-integrationログ/profile=`applet-api-portable-1794764939239/`。物理音声出力と実サービスの品質は未確認。push・外部公開・実利用先配置は行っていない。
- 辞書画面の成功profileは2回で、失敗分も含め保持した。本体の既存結合profile整理は本体側の検証記録を参照する。独自の本体/ランタイムコピーは作らず共通実行場所を使用した。

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
