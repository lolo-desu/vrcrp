package com.vrcrp.app;
import android.app.Service;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.webkit.CookieManager;
import org.json.*;
import java.io.*;
import java.net.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
public class MessageService extends Service {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private final HashMap<String,String> latest=new HashMap<>();
    private final HashMap<String,Integer> unread=new HashMap<>();
    private String user="",mode="sfw",language="zh-Hant";private long started;private int generation;private boolean destroyed;
    private final Runnable tick=this::poll;
    private SharedPreferences prefs(){return getSharedPreferences("vrcrp",0);}
    @Override public void onCreate(){super.onCreate();started=System.currentTimeMillis();ChatAlerts.channels(this);}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null&&"stop".equals(intent.getAction())){prefs().edit().putBoolean("background",false).apply();stopSelf();return START_NOT_STICKY;}
        user=prefs().getString("user","");mode=prefs().getString("mode","sfw");language=prefs().getString("language","zh-Hant");
        if(!prefs().getBoolean("background",false)||!ChatAlerts.allowed(this)||user.isEmpty()){stopSelf();return START_NOT_STICKY;}
        if(latest.isEmpty()&&user.equals(prefs().getString("baselineOwner","")))try{
            JSONArray baseline=new JSONArray(prefs().getString("baseline","[]"));for(int n=0;n<baseline.length();n++){JSONObject item=baseline.getJSONObject(n);String message=item.optString("messageId");latest.put(item.optString("id"),message.isEmpty()?item.optString("createdAt"):message);unread.put(item.optString("id"),item.optInt("unread"));}
        }catch(JSONException ignored){}
        startForeground(91,ChatAlerts.listening(this));handler.removeCallbacks(tick);handler.post(tick);return START_NOT_STICKY;
    }
    private void poll(){
        if(destroyed||!prefs().getBoolean("background",false)||!user.equals(prefs().getString("user",""))){stopSelf();return;}
        final int owner=generation;final String cookies=CookieManager.getInstance().getCookie("https://erp.sex/");if(cookies==null||cookies.isEmpty()){stopSelf();return;}
        network.execute(()->{
            long delay=10000;
            try{
                int total=getJSON("/api/v1/me/counters",cookies).optInt("unreadMessages",-1);if(total>=0)prefs().edit().putInt("chatUnread",total).apply();
                String cursor="";Set<String> visited=new HashSet<>();
                for(int page=0;page<6;page++){
                    JSONObject result=getJSON("/api/v1/matches?state=active"+(cursor.isEmpty()?"":"&cursor="+URLEncoder.encode(cursor,"UTF-8")),cookies);JSONArray items=result.optJSONArray("items");if(items==null)break;
                    for(int i=0;i<items.length();i++){
                        if(destroyed||owner!=generation||!user.equals(prefs().getString("user","")))return;
                        JSONObject item=items.optJSONObject(i);if(item==null)continue;String id=item.optString("id");if(!id.matches("[A-Za-z0-9_-]{1,120}"))continue;
                        JSONObject last=item.optJSONObject("lastMessage");int count=item.optInt("unreadCount");String print=last==null?"":last.optString("id").isEmpty()?last.optString("createdAt"):last.optString("id");
                        boolean changed=latest.containsKey(id)&&!print.equals(latest.get(id)),increased=count>unread.getOrDefault(id,count),fresh=last!=null&&timestamp(last.optString("createdAt"))>=started;
                        latest.put(id,print);unread.put(id,count);if(count<=0||!changed&&!increased&&!fresh)continue;
                        JSONObject peer=item.optJSONObject("user");
                        if(last==null||last.optString("id").isEmpty()||"text".equals(last.optString("type"))&&!last.has("text")){
                            JSONObject detail=getJSON("/api/v1/matches/"+id,cookies);peer=detail.optJSONObject("user");JSONArray messages=getJSON("/api/v1/matches/"+id+"/messages?limit=20",cookies).optJSONArray("items");
                            if(messages!=null)for(int n=0;n<messages.length();n++){JSONObject message=messages.optJSONObject(n);if(message!=null&&!user.equals(message.optString("senderId"))&&!message.optBoolean("recalled")&&(timestamp(message.optString("createdAt"))>=started||increased)){if(last==null||timestamp(message.optString("createdAt"))>=timestamp(last.optString("createdAt")))last=message;}}
                        }
                        if(last==null||user.equals(last.optString("senderId"))||last.optBoolean("recalled"))continue;
                        JSONObject notice=new JSONObject().put("messageId",last.optString("id")).put("matchId",id).put("senderId",last.optString("senderId")).put("title",peer==null?"新聊天消息":peer.optString("displayName","新聊天消息")).put("body",messageBody(last));
                        Bitmap avatar=avatar(peer,cookies);if(owner==generation&&!destroyed&&user.equals(prefs().getString("user","")))ChatAlerts.show(this,notice,avatar);
                    }
                    cursor=result.optString("nextCursor","");if(cursor.isEmpty()||"null".equals(cursor)||!visited.add(cursor)||total<=0)break;
                }
            }catch(Unauthorized e){handler.post(this::stopSelf);return;}catch(Exception e){delay=30000;}
            final long next=delay;handler.post(()->{if(!destroyed&&owner==generation)handler.postDelayed(tick,next);});
        });
    }
    private static long timestamp(String value){try{return Instant.parse(value).toEpochMilli();}catch(Exception e){return 0;}}
    private String messageBody(JSONObject m){String type=m.optString("type");if(type.equals("image"))return "[图片]";if(type.equals("voice"))return "[语音]";if(type.equals("vrc_link"))return "[VRChat 链接]";return m.optString("text","你有新的聊天消息");}
    private static class Unauthorized extends IOException{}
    private JSONObject getJSON(String path,String cookies)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL("https://erp.sex"+path).openConnection();c.setConnectTimeout(9000);c.setReadTimeout(9000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Cookie",cookies);c.setRequestProperty("Accept","application/json");c.setRequestProperty("X-Content-Mode",mode);c.setRequestProperty("Accept-Language",language);
        try{int status=c.getResponseCode();if(status==401)throw new Unauthorized();if(status!=200)throw new IOException("HTTP "+status);JSONObject value=new JSONObject(new String(readBounded(c.getInputStream(),2*1024*1024),"UTF-8"));return value.optJSONObject("data")==null?value:value.getJSONObject("data");}finally{c.disconnect();}
    }
    private Bitmap avatar(JSONObject peer,String cookies){
        if(peer==null)return null;JSONObject media=peer.optJSONObject("avatar");if(media==null||!"show".equals(media.optString("view")))return null;HttpURLConnection c=null;
        try{URL url=new URL(media.optString("thumbUrl",media.optString("url")));if(!"https".equals(url.getProtocol())||url.getUserInfo()!=null)return null;c=(HttpURLConnection)url.openConnection();c.setConnectTimeout(4000);c.setReadTimeout(4000);c.setInstanceFollowRedirects(false);if("erp.sex".equals(url.getHost()))c.setRequestProperty("Cookie",cookies);if(c.getResponseCode()!=200)return null;byte[] bytes=readBounded(c.getInputStream(),1024*1024);BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);o.inJustDecodeBounds=false;o.inSampleSize=Math.max(1,Math.max(o.outWidth,o.outHeight)/128);return BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);}catch(Exception e){return null;}finally{if(c!=null)c.disconnect();}
    }
    static byte[] readBounded(InputStream input,int limit)throws IOException{try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>limit)throw new IOException("Response too large");out.write(buffer,0,n);}return out.toByteArray();}}
    @Override public void onTimeout(int startId,int fgsType){stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    @Override public void onTaskRemoved(Intent rootIntent){stopSelf();}
    @Override public void onDestroy(){destroyed=true;generation++;handler.removeCallbacksAndMessages(null);network.shutdownNow();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
