//一回の検索で表示できる最大行
var LIMIT_ROW = 10;

//スプレットシートのURL
var SHEET_URL = "https://docs.google.com/spreadsheets/d/14gF_mGaMyxqxowmRM9LTySC4jmbeDqpjdXLIOX6CLxY/edit#gid=0"; 

//一覧検索用の単語
var ALL_KEYWORD = "#一覧";

//表示する場合のフラグ
var SHOW_FLAG = 1;

//IDをもっている列（A列を0とする）
var ID_COL = 0;

//ファイル名を持っている列
var FILE_COL = 1;

//URLを持っている列
var URL_COL = 2;

//キーワードを持っている列
var KEYWORD_COL = 3;

//表示するかを制御するフラグを持っている列
var SHOW_FLAG_COL = 4;

//スプレットシートから持ってきたい列の数(現状はA~Dで4　仕様変更に備えて実装)
var MAX_ROW = 5;

//チャットボットの文字数制限（4096不変）
var LIMIT_MAX_LENGTH = 4096;

//検索結果無し時のメッセージ
var MSG_ERROR_NOTHING = "検索対象がありませんでした。";

//チャットボット文字数制限抵触時のメッセージ
var MSG_ERROR_OVERLIMIT = "検索結果が多すぎます。\n検索キーワードを変更してください。";

//不明なエラー発生時
var MSG_ERROR_OTHER = "エラーが発生しました。";

/**
* Responds to a MESSAGE event in Hangouts Chat.
*
* @param {Object} event the event object from Hangouts Chat
*/
function onMessage(event) {
  var message = "";
  var leng = 0;
  if (getJudge(event.message.text, "天気", 3)){
    message = weatherForecast(event.message.text);
  }else{
    message = getManualURL(event.message.text,event.eventTime.seconds);
  }
  return { "text": message };
}  

/**
 * Responds to an ADDED_TO_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onAddToSpace(event) {
  var message = "";

  if (event.space.type == "DM") {
    message = "Thank you for adding me to a DM, " + event.user.displayName + "!";
  } else {
    message = "Thank you for adding me to " + event.space.displayName;
  }

  if (event.message) {
    // Bot added through @mention.
    message = message + " and you said : \"" + event.message.text + "\"";
  }

  return { "text": message };
}

/**
 * Responds to a REMOVED_FROM_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onRemoveFromSpace(event) {
  console.info("Bot removed from ", event.space.name);
}

function weatherForecast(text) {
  var strURL = "http://weather.livedoor.com/forecast/webservice/json/v1?city=";
  var city = "130010";
  if(getJudge(text,"新潟",4)){
    city = "150010";
  }
  //var response = UrlFetchApp.fetch("http://weather.livedoor.com/forecast/webservice/json/v1?city=130010"); //URL+cityID
  var response = UrlFetchApp.fetch(strURL + city);
  var json = JSON.parse(response.getContentText());
  var message = "";
  message = json["title"] + "\n";
  
  
  message = message + "今日(" + Utilities.formatDate( new Date(json["forecasts"][0]["date"]), 'Asia/Tokyo', 'yyyy/MM/dd') + ")の天気： " + json["forecasts"][0]["telop"] + "\n";
  message = message + "明日(" + Utilities.formatDate( new Date(json["forecasts"][1]["date"]), 'Asia/Tokyo', 'yyyy/MM/dd') + ")の天気： " + json["forecasts"][1]["telop"] + "\n";
  message = message + json["description"]["text"] + "\n\n";
  message = message + "予報発表時間：" + Utilities.formatDate(new Date(json["publicTime"]), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  return  message;
}

//検索する文字,表示する最大行
function getManualURL(eventMessage,eventTime) {
  //返答メッセージ
  var message = "";
  try{
    //検索ワード格納
    var target = String(eventMessage);
    
    //検索タイプ 1:通常検索 2:一覧表示 3:ID検索
    var type = 1;
    
    //AND検索用
    var listTarget = new Array();
    
    if(getJudge(target, ALL_KEYWORD,2)){// #一覧　の場合は一覧表示する。
      type = 2;
    }else if(getJudge(target,"#",3)){ //　#　が付いていたら検索先をA列にする
      type = 3;
    }else{// それ以外は通常検索
      //スペース毎に検索キーワードを分割
      while(getJudge(target,",",1)){
        target = target.replace(","," ");
      }
      while(getJudge(target,"　",1)){
        target = target.replace("　"," ");
      }
      while(getJudge(target,"  ",1)){
        target = target.replace("  "," ");
      }
      listTarget = target.split(" ");
    }  
    
    // スプレットシート取得
    try{
      var spreadSheet = SpreadsheetApp.openByUrl(SHEET_URL);
    }catch(e){
      throw ("URLエラー \n" + e);
    }
    //シート取得
    try{
      var sheet = spreadSheet.getSheetByName("一覧");
    }catch(e){
      throw ("シート取得エラー \n" + e);
    }
    //シートの最終行取得
    var rastRow = sheet.getLastRow();
    
    // (1行,1列目,　から　最終行,4列目　を取得する)
    try{
       var range = sheet.getRange(1,1,rastRow,MAX_ROW);
    }catch(e){
      throw ("セル取得エラー \n" + e);
    }
    
    //取得したデータを配列に入れる
    try{
      var values = range.getValues();
    }catch(e){
      throw ("配列格納エラー \n" + e);
    }
    //ヒット件数
    var count = 0;
    
    //URLを格納するリスト
    var listURL = new Array();
    
    //ファイル名を格納するリスト
    var listFile = new Array();
    
    //IDを格納するリスト
    var listID = new Array();
    
    if(type == 1 || type == 2){
      //一覧をループで回る
      for(var i = 1; i<rastRow; i++){
        //一覧表示またはターゲットが一覧にある場合、リストに入れる
        if(getJudge(values[i][SHOW_FLAG_COL],SHOW_FLAG,2) &&(type == 2 || getResult(values[i],listTarget,1))){
          count++;
          listID.push(String(values[i][ID_COL]));
          listFile.push(String(values[i][FILE_COL]));
          listURL.push(String(values[i][URL_COL]));
        }    
      }
    }else if(type == 3){
      //A列を検索の対象にする
      for(var i = 1; i<rastRow; i++){
        //ターゲットが一覧にある場合リストに入れ、以降の検索を中止
        if(getJudge(values[i][SHOW_FLAG_COL],SHOW_FLAG,2) && getJudge(String(values[i][ID_COL]),target,2)){
          count=-1;
          listID.push(String(values[i][ID_COL]));
          listFile.push(String(values[i][FILE_COL]));
          listURL.push(String(values[i][URL_COL]));
          break;
        }
      }
    }
    
    if(count == -1 ){ //ID検索で見つかった場合
      message = "検索結果\n\n" +listFile[0]+ "\n" + listURL[0]; 
    }else if(count == 0){ //検索結果が0件の場合
      message = MSG_ERROR_NOTHING;
    }else if(count > 0 && count <= LIMIT_ROW){　//検索結果が１件以上かつ限界値以下の場合
      if(type == 2){　//一覧表示の場合
        message = "一覧 \n\n";
      }else{ //一覧表示ではない場合
        message = "検索結果" + count + "件 \n\n";
      }
      for(var i = 0; i < count; i++){
        message = message + listFile[i] +"\n" + listURL[i] + "\n\n";
      }
    }else{ //検索結果が限界値以上の場合
      if(type == 2){　//一覧表示の場合
        message = "一覧 \n\n";
      }else{ //一覧表示ではない場合
        message = "検索結果" + count + "件 \n\n";
      }
      for(var i = 0; i < count; i++){
        message = message + listID[i] + " " + listFile[i] + "\n";
      }
      message = message + "\n" + "#で始まる５桁のIDで再度検索するとURLを表示します。";
    }
    var logSheet = spreadSheet.getSheetByName("検索ログ");
    var logLastRow =logSheet.getLastRow();   
    if(message.length > LIMIT_MAX_LENGTH){
      message = MSG_ERROR_OVERLIMIT;
    }
  }catch(e){
    message = MSG_ERROR_OTHER +"\n" + e;
  }finally{
    //messageをreturn
    setLog(logSheet,message,listID,eventMessage,eventTime)
    return message;
  }
}

/*
** AND検索用(スプレットーシートから得た配列,ANDで検索する文字配列,検索するタイプ(部分一致が基本))
*/
function getResult(values,listTarget,type){
  for(var i=0;i<listTarget.length;i++){ //文字配列の個数だけ検索する。
    if(!getJudge(String(values[FILE_COL]),listTarget[i],type)　&& !getJudge(String(values[KEYWORD_COL]),listTarget[i],type)){
    //B列にもD列にも検索文字列がない場合の処理
      return false;//ANDの条件を満たさないのでfalseでreturn
    }
  }
  return true;//ANDの条件を満たしたのでtrueでreturn
}

//ログ出力関数
function setLog(logSheet,message,listID,eventMessage,eventTime){
  var logLastRow = logSheet.getLastRow();
  logSheet.getRange(logLastRow+1,1).setValue(String(eventMessage));
  var data = new Date((1+eventTime)*1000);
  var year = data.getFullYear();
  var month = ('0' + (data.getMonth()+1)).slice(-2);
  var date = ('0' + data.getDate()).slice(-2);
  var hours = ('0' + data.getHours()).slice(-2);
  var minutes = ('0' + data.getMinutes()).slice(-2);
  var seconds = ('0' + data.getSeconds()).slice(-2);
  var output = "";
  logSheet.getRange(logLastRow+1,2).setValue(year + "/" + month + "/" + date + " " + hours + ":" + minutes + ":" + seconds);
  if (getJudge(message,MSG_ERROR_NOTHING,2)){
    logSheet.getRange(logLastRow+1,3).setValue(MSG_ERROR_NOTHING);
  }else if(getJudge(message,MSG_ERROR_OVERLIMIT,2)){
    logSheet.getRange(logLastRow+1,3).setValue(MSG_ERROR_OVERLIMIT);
  }else if(getJudge(message,MSG_ERROR_OTHER,3)){
    logSheet.getRange(logLastRow+1,3).setValue(message);
  }else{
    for(var i=0;i<listID.length;i++){
      output = output + listID[i] +",";
    }
    output = output.substr(0,output.length-1)
    logSheet.getRange(logLastRow+1,3).setValue(output);
  }
  return;
}


//文字列検索関数(検索対象文字列,検索文字,検索するタイプ)
function getJudge(text,target,type){
  if(type == 1){//type=1:部分一致検索
    return (text.indexOf(target) > -1);
  }else if(type == 2){//type=2:完全一致検索
    return (text ===　target);
  }else if(type == 3){//type=3:前方一致検索
    return (!text.indexOf(target));
  }else if(type == 4){//type=4:後方一致検索
    return ((text.lastIndexOf(target)+target.length === text.length)&&(target.length<=text.length));
  }
}