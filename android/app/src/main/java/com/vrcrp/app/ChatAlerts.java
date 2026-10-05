package com.vrcrp.app;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.*;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import org.json.JSONObject;
import org.json.JSONArray;
import java.util.*;
final class ChatAlerts {
    static int total;
    private static final ChatReadState state=new ChatReadState();
    static void channels(Context c){NotificationManager m=c.getSystemService(NotificationManager.class);NotificationChannel messages=new NotificationChannel("messages","聊天消息",NotificationManager.IMPORTANCE_HIGH);messages.setDescription("配对聊天的新消息");NotificationChannel service=new NotificationChannel("listening","后台监听状态",NotificationManager.IMPORTANCE_LOW);service.setShowBadge(false);m.createNotificationChannel(messages);m.createNotificationChannel(service);}
    static boolean allowed(Context c){return(Build.VERSION.SDK_INT<33||c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)&&NotificationManagerCompat.from(c).areNotificationsEnabled();}
    static synchronized void reset(Context c){state.owner(c.getSharedPreferences("vrcrp",0).getString("user",""));NotificationManagerCompat.from(c).cancelAll();}
    static synchronized ChatReadState.Token prepare(Context c,JSONObject v){
        String user=c.getSharedPreferences("vrcrp",0).getString("user","");state.owner(user);
        if(user.isEmpty()||!allowed(c)||user.equals(v.optString("senderId"))||v.optString("body").isEmpty())return null;
        return state.reserve(user,v.optString("messageId"),v.optString("matchId"),v.optString("createdAt"));
    }
    static synchronized void show(Context c,JSONObject v){finish(c,v,null,prepare(c,v));}
    static synchronized void finish(Context c,JSONObject v,Bitmap avatar,ChatReadState.Token token){
        if(!allowed(c)||!state.allowed(token,c.getSharedPreferences("vrcrp",0).getString("user","")))return;
        String thread=token.thread,body=v.optString("body"),name=v.optString("title","新聊天消息");
        Intent intent=new Intent(c,MainActivity.class).putExtra("chat",thread).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open=PendingIntent.getActivity(c,thread.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Person.Builder sender=new Person.Builder().setName(name).setKey(v.optString("senderId",thread));if(avatar!=null)sender.setIcon(IconCompat.createWithBitmap(avatar));
        NotificationCompat.MessagingStyle style=new NotificationCompat.MessagingStyle(new Person.Builder().setName("我").build()).addMessage(body,System.currentTimeMillis(),sender.build());
        Bundle info=new Bundle();info.putString("vrcrp.owner",token.owner);info.putString("vrcrp.messageId",token.id);info.putString("vrcrp.thread",token.thread);info.putString("vrcrp.createdAt",token.createdAt);
        Notification n=new NotificationCompat.Builder(c,"messages").addExtras(info).setSmallIcon(R.drawable.ic_notification).setContentTitle(name).setContentText(body).setStyle(style).setContentIntent(open).setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_MESSAGE).setGroup("chat-"+thread).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build();
        try{NotificationManagerCompat.from(c).notify("chat-"+thread,thread.hashCode(),n);}catch(SecurityException ignored){}
    }
    static synchronized void activeThread(Context c,String thread){
        state.owner(c.getSharedPreferences("vrcrp",0).getString("user",""));state.activeThread(thread);
        if(!thread.isEmpty())NotificationManagerCompat.from(c).cancel("chat-"+thread,thread.hashCode());
    }
    static synchronized void read(Context c,JSONObject event){
        String user=c.getSharedPreferences("vrcrp",0).getString("user","");if(user.isEmpty()||!user.equals(event.optString("userId")))return;
        state.owner(user);ArrayList<String> ids=new ArrayList<>();JSONArray array=event.optJSONArray("messageIds");
        if(array!=null)for(int i=0;i<Math.min(array.length(),512);i++)ids.add(array.optString(i));
        String thread=event.optString("matchId");state.read(thread,event.optString("lastMessageId"),event.optString("createdAt"),ids);
        for(android.service.notification.StatusBarNotification notice:c.getSystemService(NotificationManager.class).getActiveNotifications()){
            if(!("chat-"+thread).equals(notice.getTag()))continue;
            Bundle info=notice.getNotification().extras;String id=info.getString("vrcrp.messageId","");
            if(id.isEmpty()||user.equals(info.getString("vrcrp.owner"))&&state.isRead(id,thread,info.getString("vrcrp.createdAt","")))NotificationManagerCompat.from(c).cancel(notice.getTag(),notice.getId());
        }
    }
    static Notification listening(Context c){PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);PendingIntent stop=PendingIntent.getService(c,1,new Intent(c,MessageService.class).setAction("stop"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);return new NotificationCompat.Builder(c,"listening").setSmallIcon(R.drawable.ic_notification).setContentTitle("vrcrp 正在监听聊天消息").setContentText("点击打开 App；也可停止后台监听").setContentIntent(open).addAction(0,"停止监听",stop).setOngoing(true).setSilent(true).setCategory(NotificationCompat.CATEGORY_SERVICE).build();}
}
