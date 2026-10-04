package com.vrcrp.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.util.Base64;
import android.util.LruCache;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.*;
import java.io.*;
import java.util.*;

public class MainActivity extends Activity {
    private FrameLayout root, content, tabs;
    private WebView web, external;
    private LinearLayout externalPanel;
    private TextView address;
    private ProgressBar loading;
    private ImageView restoration;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String entry = "", path = "/", pendingChat = "", pendingTab = "";
    private boolean canBack, keyboard, visible, firstReady, pageReady;
    private String sessionContext="";
    private int surface = Color.rgb(250,250,250), canvas = surface, accent = Color.rgb(50,50,50);
    private JSONObject navigation;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest mediaRequest;
    private final LruCache<String,Bitmap> snapshots = new LruCache<String,Bitmap>(24*1024*1024) {
        @Override protected int sizeOf(String key, Bitmap bitmap) { return bitmap.getByteCount(); }
    };
    private final Runnable capture = () -> capturePage();
    private final Runnable viewport = () -> updateViewport();
    private SharedPreferences prefs() { return getSharedPreferences("vrcrp", MODE_PRIVATE); }
    private int dp(float value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private int color(JSONArray array, int fallback) {
        if(array==null||array.length()<3)return fallback;
        return Color.argb((int)(255*array.optDouble(3,1)),(int)(255*array.optDouble(0)),(int)(255*array.optDouble(1)),(int)(255*array.optDouble(2)));
    }
    private GradientDrawable background(int color,float radius) { GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d; }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(),false);
        root=new FrameLayout(this);root.setBackgroundColor(surface);setContentView(root);
        content=new FrameLayout(this);root.addView(content,new FrameLayout.LayoutParams(-1,-1));
        web=new WebView(this);content.addView(web,new FrameLayout.LayoutParams(-1,-1));configure(web,true);
        restoration=new ImageView(this);restoration.setScaleType(ImageView.ScaleType.FIT_XY);restoration.setVisibility(View.GONE);content.addView(restoration,new FrameLayout.LayoutParams(-1,-1));
        tabs=new FrameLayout(this);tabs.setVisibility(View.GONE);FrameLayout.LayoutParams tabLayout=new FrameLayout.LayoutParams(-1,dp(64),Gravity.BOTTOM);content.addView(tabs,tabLayout);
        loading=new ProgressBar(this);FrameLayout.LayoutParams progress=new FrameLayout.LayoutParams(dp(40),dp(40),Gravity.CENTER);content.addView(loading,progress);
        ViewCompat.setOnApplyWindowInsetsListener(root,(view,insets)->{
            Insets system=insets.getInsets(WindowInsetsCompat.Type.systemBars()),ime=insets.getInsets(WindowInsetsCompat.Type.ime());
            keyboard=insets.isVisible(WindowInsetsCompat.Type.ime());
            FrameLayout.LayoutParams p=(FrameLayout.LayoutParams)content.getLayoutParams();p.topMargin=system.top;p.leftMargin=system.left;p.rightMargin=system.right;p.bottomMargin=Math.max(system.bottom,ime.bottom);content.setLayoutParams(p);
            if(navigation!=null)renderTabs(navigation);handler.removeCallbacks(viewport);handler.post(viewport);return insets;
        });
        web.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{handler.removeCallbacks(viewport);handler.post(viewport);});
        ChatAlerts.channels(this);
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::back);
        acceptIntent(getIntent());web.loadUrl("https://erp.sex/");
    }
    private void configure(WebView view, boolean main) {
        WebSettings s=view.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportZoom(false);s.setBuiltInZoomControls(false);s.setDisplayZoomControls(false);s.setMediaPlaybackRequiresUserGesture(false);s.setTextZoom(100);s.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(view,false);view.setBackgroundColor(surface);
        view.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                if(!request.isForMainFrame())return false;
                Uri u=request.getUrl();String scheme=u.getScheme();
                if(!"http".equals(scheme)&&!"https".equals(scheme)){
                    if(Arrays.asList("mailto","tel","vrchat").contains(scheme))try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(ActivityNotFoundException e){Toast.makeText(MainActivity.this,"没有可打开此链接的应用",Toast.LENGTH_SHORT).show();}
                    return true;
                }
                if(main&&!"erp.sex".equals(u.getHost())){openExternal(u.toString());return true;}
                return false;
            }
            @Override public void onPageFinished(WebView v,String url) {
                if(main){CookieManager.getInstance().flush();if(!firstReady)loading.setVisibility(View.GONE);updateViewport();}
                else address.setText(Uri.parse(url).getHost());
            }
            @Override public void onReceivedError(WebView v,WebResourceRequest request,WebResourceError error){
                if(request.isForMainFrame()&&main&&!firstReady){loading.setVisibility(View.GONE);new AlertDialog.Builder(MainActivity.this).setTitle("暂时无法连接").setMessage("请检查网络连接后重试。").setPositiveButton("重试",(d,w)->web.reload()).setNegativeButton("关闭",(d,w)->finish()).show();}
            }
        });
        view.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onCreateWindow(WebView v,boolean dialog,boolean gesture,Message result){
                if(!gesture)return false;
                WebView popup=new WebView(MainActivity.this);popup.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest request){openExternal(request.getUrl().toString());popup.destroy();return true;}});
                ((WebView.WebViewTransport)result.obj).setWebView(popup);result.sendToTarget();return true;
            }
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
                try{startActivityForResult(params.createIntent(),41);return true;}catch(ActivityNotFoundException e){fileCallback.onReceiveValue(null);fileCallback=null;return false;}
            }
            @Override public void onPermissionRequest(PermissionRequest request){
                runOnUiThread(()->{
                    if(!"https://erp.sex".equals(request.getOrigin().toString().replaceAll("/$",""))){request.deny();return;}
                    ArrayList<String> permissions=new ArrayList<>();
                    for(String resource:request.getResources())if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource))permissions.add(Manifest.permission.RECORD_AUDIO);else if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource))permissions.add(Manifest.permission.CAMERA);
                    if(permissions.isEmpty()){request.deny();return;}
                    mediaRequest=request;requestPermissions(permissions.toArray(new String[0]),43);
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request){if(mediaRequest==request)mediaRequest=null;}
        });
        if(main){
            if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)||!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
                new AlertDialog.Builder(this).setTitle("需要更新 Android System WebView").setMessage("请在应用商店更新系统 WebView 后重新打开 vrcrp。").setPositiveButton("关闭",(d,w)->finish()).show();return;
            }
            Set<String> origins=Collections.singleton("https://erp.sex");
            if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(view,"VRBridge",origins,(v,message,origin,mainFrame,reply)->{
                if(!mainFrame||!"https".equals(origin.getScheme())||!"erp.sex".equals(origin.getHost()))return;
                String data=message.getData();if(data==null||data.length()>1500000)return;
                try{JSONObject packet=new JSONObject(data);handle(packet.optString("channel"),packet.getJSONObject("body"));}catch(JSONException ignored){}
            });
            String[] files={"android-host.js","chinese-converter.js","app-language.js","app-theme.js","page-surfaces.js","interaction.js","site-cache.js","notifications.js","keyboard.js","page-templates.js","app-experience.js","content-experience.js","chat-pins.js","notification-read.js"};
            StringBuilder source=new StringBuilder();for(String file:files)try(InputStream in=getAssets().open(file)){source.append(new String(MessageService.readBounded(in,2*1024*1024),java.nio.charset.StandardCharsets.UTF_8)).append("\n;\n");}catch(IOException e){throw new IllegalStateException("Missing script "+file,e);}
            if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))WebViewCompat.addDocumentStartJavaScript(view,source.toString(),origins);
        }
    }
    private void js(String source) { if(web!=null)web.evaluateJavascript(source,null); }
    private void updateViewport() { if(web!=null&&web.getHeight()>0)js("window.__vrcrpSetViewport?.({height:"+web.getHeight()/getResources().getDisplayMetrics().density+",width:"+web.getWidth()/getResources().getDisplayMetrics().density+",keyboardVisible:"+keyboard+"});"); }
    private void handle(String channel,JSONObject data) {
        String kind=data.optString("kind");
        if("notifications".equals(channel)) {
            if("session".equals(kind)) {
                String context=data.optString("userId")+"|"+data.optString("mode")+"|"+data.optString("language");if(!sessionContext.equals(context)){snapshots.evictAll();sessionContext=context;}
                String old=prefs().getString("user","");String user=data.optString("userId");
                if(!user.matches("[A-Za-z0-9_-]{1,120}"))user="";
                prefs().edit().putString("user",user).putString("mode",data.optString("mode","sfw")).putString("language",data.optString("language","zh-Hant")).apply();
                if(!old.equals(user)){snapshots.evictAll();ChatAlerts.reset(this);stopService(new Intent(this,MessageService.class));}
                if(!user.isEmpty()){requestNotificationPermission();openPendingChat();}
            } else if("snapshot".equals(kind)) {
                JSONArray items=data.optJSONArray("items"),baseline=new JSONArray();
                if(items!=null)for(int n=0;n<Math.min(items.length(),200);n++){
                    JSONObject item=items.optJSONObject(n);if(item==null)continue;
                    try{baseline.put(new JSONObject().put("id",item.optString("matchId")).put("messageId",item.optString("messageId")).put("createdAt",item.optString("createdAt")).put("unread",item.optInt("unread")));}catch(JSONException ignored){}
                }
                prefs().edit().putString("baseline",baseline.toString()).putString("baselineOwner",prefs().getString("user","")).apply();
            } else if("chatMessage".equals(kind))ChatAlerts.show(this,data);
            else if("counters".equals(kind)){ChatAlerts.total=data.optInt("unread",0);prefs().edit().putInt("chatUnread",ChatAlerts.total).apply();}
            return;
        }
        switch(kind) {
            case "ready": firstReady=true;loading.setVisibility(View.GONE);updateViewport();js("window.__vrcrpAppActive?.("+visible+");");break;
            case "topSurface": surface=color(data.optJSONArray("color"),surface);applyBars();break;
            case "paletteChanged": canvas=color(data.optJSONArray("background"),canvas);accent=color(data.optJSONArray("primary"),accent);surface=color(data.optJSONArray("surface"),surface);snapshots.evictAll();web.setBackgroundColor(canvas);applyBars();break;
            case "navigation": navigation=data;renderTabs(data);break;
            case "route":
                String next=data.optString("entryKey");String nextPath=data.optString("path","/");
                canBack=data.optBoolean("canGoBack");path=nextPath;
                if(!data.optBoolean("showTabs"))tabs.setVisibility(View.GONE);
                if(!next.equals(entry)){
                    pageReady=false;
                    restoration.animate().cancel();restoration.setVisibility(View.GONE);
                    Bitmap image="pop".equals(data.optString("direction"))?snapshots.get(next):null;
                    if(image!=null){restoration.setImageBitmap(image);restoration.setAlpha(1);restoration.setVisibility(View.VISIBLE);final String owner=next;handler.postDelayed(()->{if(entry.equals(owner))hideRestoration();},1600);}
                    entry=next;
                }
                pendingTab="";if(path.matches("/matches/[A-Za-z0-9_-]{1,120}"))ChatAlerts.clearThread(this,path.substring(9));
                break;
            case "willNavigate":pageReady=false;handler.removeCallbacks(capture);break;
            case "pagePainted": if(entry.equals(data.optString("entryKey"))){pageReady=true;hideRestoration();handler.removeCallbacks(capture);handler.postDelayed(capture,120);}break;
            case "viewUpdated": handler.removeCallbacks(capture);handler.postDelayed(capture,180);break;
            case "languageChanged":snapshots.evictAll();break;
            case "haptic": web.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);break;
            case "notificationSettings":startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));break;
            case "backgroundListening":
                boolean enabled=data.optBoolean("enabled");if(enabled&&!ChatAlerts.allowed(this)){requestNotificationPermission();enabled=false;Toast.makeText(this,"请先允许通知，再开启后台监听",Toast.LENGTH_SHORT).show();}
                prefs().edit().putBoolean("background",enabled).apply();if(!enabled)stopService(new Intent(this,MessageService.class));backgroundState();break;
            case "backgroundStatus":backgroundState();break;
            default:break;
        }
    }
    private void applyBars(){
        root.setBackgroundColor(surface);getWindow().setStatusBarColor(surface);getWindow().setNavigationBarColor(surface);
        boolean light=(.2126*Color.red(surface)+.7152*Color.green(surface)+.0722*Color.blue(surface))>140;
        androidx.core.view.WindowInsetsControllerCompat controller=WindowCompat.getInsetsController(getWindow(),root);controller.setAppearanceLightStatusBars(light);controller.setAppearanceLightNavigationBars(light);
        loading.getIndeterminateDrawable().setTint(accent);
    }
    private void renderTabs(JSONObject model){
        if(keyboard||!model.optBoolean("visible")||external!=null){tabs.setVisibility(View.GONE);return;}
        JSONArray items=model.optJSONArray("items");if(items==null)return;
        JSONObject frame=model.optJSONObject("frame");float height=frame==null?64:(float)frame.optDouble("height",64);
        FrameLayout.LayoutParams layout=(FrameLayout.LayoutParams)tabs.getLayoutParams();layout.height=dp(height);tabs.setLayoutParams(layout);tabs.setBackgroundColor(color(model.optJSONArray("background"),surface));tabs.removeAllViews();
        int selectedColor=color(model.optJSONArray("selectedColor"),accent),muted=color(model.optJSONArray("mutedColor"),Color.GRAY);
        for(int n=0;n<items.length();n++){
            JSONObject item=items.optJSONObject(n);if(item==null)continue;
            boolean selected=!pendingTab.isEmpty()?pendingTab.equals(item.optString("path")):item.optBoolean("selected");int ink=selected?selectedColor:muted;
            JSONObject f=item.optJSONObject("frame");if(f==null)continue;
            LinearLayout button=new LinearLayout(this);button.setOrientation(LinearLayout.VERTICAL);button.setGravity(Gravity.CENTER);button.setContentDescription(item.optString("title"));
            button.setBackground(background(selected?Color.argb(24,Color.red(selectedColor),Color.green(selectedColor),Color.blue(selectedColor)):Color.TRANSPARENT,(float)item.optDouble("radius",8)));
            FrameLayout iconBox=new FrameLayout(this);ImageView icon=new ImageView(this);icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
            String encoded=item.optString("icon");try{byte[] raw=Base64.decode(encoded.substring(encoded.indexOf(',')+1),Base64.DEFAULT);icon.setImageBitmap(BitmapFactory.decodeByteArray(raw,0,raw.length));icon.setColorFilter(ink);}catch(Exception ignored){}
            iconBox.addView(icon,new FrameLayout.LayoutParams(dp(23),dp(23),Gravity.CENTER));
            JSONObject badge=item.optJSONObject("badge");if(badge!=null){TextView dot=new TextView(this);dot.setText(badge.optString("title"));dot.setTextSize(9);dot.setTextColor(color(badge.optJSONArray("color"),Color.WHITE));dot.setGravity(Gravity.CENTER);dot.setBackground(background(color(badge.optJSONArray("background"),selectedColor),20));FrameLayout.LayoutParams dotLayout=new FrameLayout.LayoutParams(dot.getText().length()==0?dp(7):dp(18),dot.getText().length()==0?dp(7):dp(14),Gravity.RIGHT|Gravity.TOP);iconBox.addView(dot,dotLayout);}
            button.addView(iconBox,new LinearLayout.LayoutParams(dp(40),dp(26)));
            TextView label=new TextView(this);label.setText(item.optString("title"));label.setTextColor(ink);label.setTextSize((float)item.optDouble("fontSize",11));label.setTypeface(null,item.optBoolean("bold")?Typeface.BOLD:Typeface.NORMAL);label.setGravity(Gravity.CENTER);button.addView(label,new LinearLayout.LayoutParams(-1,dp(20)));
            FrameLayout.LayoutParams p=new FrameLayout.LayoutParams(dp((float)f.optDouble("width")),dp((float)f.optDouble("height")));p.leftMargin=dp((float)f.optDouble("x"));p.topMargin=dp((float)f.optDouble("y"));tabs.addView(button,p);
            int slot=item.optInt("slot",n);String target=item.optString("path");button.setOnClickListener(v->{pendingTab=target;renderTabs(model);web.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);js("window.__vrcrpActivateTab?.("+slot+")");});
        }
        tabs.setVisibility(View.VISIBLE);js("window.__vrcrpNativeNavReady?.()");
    }
    private void capturePage(){
        if(!pageReady||entry.isEmpty()||keyboard||external!=null||restoration.getVisibility()==View.VISIBLE||web.getWidth()==0||web.getHeight()==0)return;
        int width=Math.min(512,web.getWidth()),height=Math.max(1,(int)((float)web.getHeight()*width/web.getWidth()));
        try{Bitmap image=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);Canvas c=new Canvas(image);c.scale((float)width/web.getWidth(),(float)height/web.getHeight());web.draw(c);snapshots.put(entry,image);}catch(OutOfMemoryError ignored){snapshots.evictAll();}
    }
    private void hideRestoration(){restoration.animate().cancel();restoration.animate().alpha(0).setDuration(100).withEndAction(()->{restoration.setVisibility(View.GONE);restoration.setImageDrawable(null);restoration.setAlpha(1);}).start();}
    private void backgroundState(){
        boolean enabled=prefs().getBoolean("background",false);JSONObject status=new JSONObject();try{status.put("enabled",enabled);status.put("state",enabled?"foreground":"off");status.put("description",enabled?"离开 App 后启动后台消息服务":"后台监听已关闭");}catch(JSONException ignored){}js("window.__vrcrpBackgroundState?.("+status+");");
    }
    private void requestNotificationPermission(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED&&!prefs().getBoolean("notificationAsked",false)){prefs().edit().putBoolean("notificationAsked",true).apply();requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},42);}}
    private void openPendingChat(){if(!pendingChat.isEmpty()&&!prefs().getString("user","").isEmpty()){String id=pendingChat;pendingChat="";js("window.__vrcrpOpenChat?.("+JSONObject.quote(id)+");");}}
    private void acceptIntent(Intent intent){String id=intent.getStringExtra("chat");if(id!=null&&id.matches("[A-Za-z0-9_-]{1,120}"))pendingChat=id;}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);acceptIntent(intent);openPendingChat();}
    private TextView toolbarButton(String title,Runnable action){TextView button=new TextView(this);button.setText(title);button.setTextSize(18);button.setGravity(Gravity.CENTER);button.setTextColor(accent);button.setContentDescription(title);button.setOnClickListener(v->action.run());return button;}
    private void openExternal(String url){
        Uri u=Uri.parse(url);if(!Arrays.asList("https","http").contains(u.getScheme()))return;
        if(external!=null){external.loadUrl(url);return;}
        tabs.setVisibility(View.GONE);externalPanel=new LinearLayout(this);externalPanel.setOrientation(LinearLayout.VERTICAL);externalPanel.setBackgroundColor(surface);content.addView(externalPanel,new FrameLayout.LayoutParams(-1,-1));
        LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setBackgroundColor(surface);
        bar.addView(toolbarButton("‹",()->{if(external.canGoBack())external.goBack();else closeExternal();}),new LinearLayout.LayoutParams(dp(46),dp(52)));
        bar.addView(toolbarButton("›",()->{if(external.canGoForward())external.goForward();}),new LinearLayout.LayoutParams(dp(46),dp(52)));
        address=new TextView(this);address.setText(u.getHost());address.setTextSize(13);address.setTextColor(accent);address.setGravity(Gravity.CENTER);address.setMaxLines(1);bar.addView(address,new LinearLayout.LayoutParams(0,dp(52),1));
        bar.addView(toolbarButton("关闭",this::closeExternal),new LinearLayout.LayoutParams(dp(58),dp(52)));externalPanel.addView(bar);
        external=new WebView(this);configure(external,false);externalPanel.addView(external,new LinearLayout.LayoutParams(-1,0,1));external.loadUrl(url);
    }
    private void closeExternal(){if(external==null)return;external.stopLoading();external.destroy();external=null;content.removeView(externalPanel);externalPanel=null;if(navigation!=null)renderTabs(navigation);applyBars();}
    private void back(){
        if(external!=null){if(external.canGoBack())external.goBack();else closeExternal();return;}
        web.evaluateJavascript("window.__vrcrpAndroidBack?.()===true",value->{if(!"true".equals(value)){if(web.canGoBack())web.goBack();else finish();}});
    }
    @Override public void onBackPressed(){back();}
    @Override protected void onResume(){super.onResume();visible=true;stopService(new Intent(this,MessageService.class));if(web!=null){web.onResume();js("window.__vrcrpAppActive?.(true)");backgroundState();}ViewCompat.requestApplyInsets(root);}
    @Override protected void onPause(){visible=false;js("window.__vrcrpAppActive?.(false)");CookieManager.getInstance().flush();super.onPause();}
    @Override protected void onStop(){super.onStop();if(!isFinishing()&&prefs().getBoolean("background",false)&&!prefs().getString("user","").isEmpty()&&ChatAlerts.allowed(this))ContextCompat.startForegroundService(this,new Intent(this,MessageService.class));}
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==43&&mediaRequest!=null){boolean granted=results.length>0;for(int result:results)granted&=result==PackageManager.PERMISSION_GRANTED;if(granted)mediaRequest.grant(mediaRequest.getResources());else mediaRequest.deny();mediaRequest=null;}}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==41&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}}
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(fileCallback!=null)fileCallback.onReceiveValue(null);if(mediaRequest!=null)mediaRequest.deny();stopService(new Intent(this,MessageService.class));if(external!=null)external.destroy();if(web!=null){content.removeView(web);web.destroy();web=null;}snapshots.evictAll();super.onDestroy();}
}
