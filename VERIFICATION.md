# 検証記録

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
