package com.vrcrp.app;

import java.time.Instant;
import java.util.*;

/** Account-owned notification leases: reading or entering a chat revokes old work. */
final class ChatReadState {
    static final class Token {
        final String owner, id, thread, createdAt;
        Token(String owner,String id,String thread,String createdAt){this.owner=owner;this.id=id;this.thread=thread;this.createdAt=createdAt;}
    }
    private String owner="",activeThread="";
    private final LinkedHashSet<String> seen=new LinkedHashSet<>(),readIDs=new LinkedHashSet<>();
    private final LinkedHashMap<String,String> through=new LinkedHashMap<>();
    private final LinkedHashMap<String,Token> pending=new LinkedHashMap<>();
    synchronized void owner(String next){if(!owner.equals(next)){owner=next;activeThread="";seen.clear();readIDs.clear();through.clear();pending.clear();}}
    synchronized Token reserve(String user,String id,String thread,String createdAt){
        if(user.isEmpty()||!owner.equals(user)||!valid(id)||!valid(thread)||seen.contains(id))return null;
        seen.add(id);trim(seen,1024);
        if(activeThread.equals(thread)||isRead(id,thread,createdAt))return null;
        Token token=new Token(user,id,thread,createdAt);pending.put(id,token);
        while(pending.size()>512)pending.remove(pending.keySet().iterator().next());
        return token;
    }
    synchronized boolean allowed(Token token,String user){return token!=null&&owner.equals(user)&&token.owner.equals(owner)&&pending.get(token.id)==token&&!activeThread.equals(token.thread)&&!isRead(token.id,token.thread,token.createdAt);}
    synchronized void activeThread(String thread){
        if(activeThread.equals(thread))return;activeThread=thread;
        if(!thread.isEmpty())pending.values().removeIf(token->token.thread.equals(thread));
    }
    synchronized void read(String thread,String last,String createdAt,Collection<String> ids){
        if(!valid(thread)||!valid(last))return;
        readIDs.add(last);for(String id:ids)if(valid(id))readIDs.add(id);trim(readIDs,2048);
        long next=time(createdAt),before=time(through.get(thread));
        if(next>0&&next>=before)through.put(thread,createdAt);
        while(through.size()>256)through.remove(through.keySet().iterator().next());
        pending.values().removeIf(token->token.thread.equals(thread)&&isRead(token.id,thread,token.createdAt));
    }
    synchronized boolean isRead(String id,String thread,String createdAt){
        if(readIDs.contains(id))return true;
        long at=time(createdAt),cutoff=time(through.get(thread));return at>0&&cutoff>0&&at<cutoff;
    }
    private static boolean valid(String id){return id!=null&&id.matches("[A-Za-z0-9_-]{1,120}");}
    private static long time(String value){try{return Instant.parse(value).toEpochMilli();}catch(Exception e){return 0;}}
    private static void trim(LinkedHashSet<String> set,int size){while(set.size()>size)set.remove(set.iterator().next());}
}
