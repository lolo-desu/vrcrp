package com.vrcrp.app;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import androidx.core.app.*;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import org.json.JSONObject;
import java.util.*;
final class ChatAlerts {
    static int total;
    private static final LinkedHashSet<String> seen=new LinkedHashSet<>();
    private static String owner="";
    static void channels(Context c){NotificationManager m=c.getSystemService(NotificationManager.class);NotificationChannel messages=new NotificationChannel("messages","聊天消息",NotificationManager.IMPORTANCE_HIGH);messages.setDescription("配对聊天的新消息");NotificationChannel service=new NotificationChannel("listening","后台监听状态",NotificationManager.IMPORTANCE_LOW);service.setShowBadge(false);m.createNotificationChannel(messages);m.createNotificationChannel(service);}
    static boolean allowed(Context c){return(Build.VERSION.SDK_INT<33||c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)&&NotificationManagerCompat.from(c).areNotificationsEnabled();}
    static synchronized void reset(Context c){seen.clear();owner=c.getSharedPreferences("vrcrp",0).getString("user","");NotificationManagerCompat.from(c).cancelAll();}
    static synchronized void show(Context c,JSONObject v){show(c,v,null);}
    static synchronized void show(Context c,JSONObject v,Bitmap avatar){
        String user=c.getSharedPreferences("vrcrp",0).getString("user","");if(user.isEmpty()||!allowed(c))return;
        if(!owner.equals(user)){seen.clear();owner=user;}
        String id=v.optString("messageId"),thread=v.optString("matchId"),body=v.optString("body"),name=v.optString("title","新聊天消息");
        if(!id.matches("[A-Za-z0-9_-]{1,120}")||!thread.matches("[A-Za-z0-9_-]{1,120}")||seen.contains(id)||body.isEmpty())return;
        seen.add(id);while(seen.size()>512)seen.remove(seen.iterator().next());
        Intent intent=new Intent(c,MainActivity.class).putExtra("chat",thread).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open=PendingIntent.getActivity(c,thread.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Person.Builder sender=new Person.Builder().setName(name).setKey(v.optString("senderId",thread));if(avatar!=null)sender.setIcon(IconCompat.createWithBitmap(avatar));
        NotificationCompat.MessagingStyle style=new NotificationCompat.MessagingStyle(new Person.Builder().setName("我").build()).addMessage(body,System.currentTimeMillis(),sender.build());
        Notification n=new NotificationCompat.Builder(c,"messages").setSmallIcon(R.drawable.ic_notification).setContentTitle(name).setContentText(body).setStyle(style).setContentIntent(open).setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_MESSAGE).setGroup("chat-"+thread).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build();
        try{NotificationManagerCompat.from(c).notify("chat-"+thread,thread.hashCode(),n);}catch(SecurityException ignored){}
    }
    static void clearThread(Context c,String thread){NotificationManagerCompat.from(c).cancel("chat-"+thread,thread.hashCode());}
    static Notification listening(Context c){PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);PendingIntent stop=PendingIntent.getService(c,1,new Intent(c,MessageService.class).setAction("stop"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);return new NotificationCompat.Builder(c,"listening").setSmallIcon(R.drawable.ic_notification).setContentTitle("vrcrp 正在监听聊天消息").setContentText("点击打开 App；也可停止后台监听").setContentIntent(open).addAction(0,"停止监听",stop).setOngoing(true).setSilent(true).setCategory(NotificationCompat.CATEGORY_SERVICE).build();}
}
