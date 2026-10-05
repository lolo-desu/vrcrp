package com.vrcrp.app;

import java.util.*;

public final class ChatReadStateChecks {
    private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    public static void main(String[] args){
        ChatReadState state=new ChatReadState();state.owner("self");
        String at="2026-01-02T00:00:00Z";
        ChatReadState.Token avatar=state.reserve("self","waiting-avatar","thread",at);
        check(state.allowed(avatar,"self"),"initial notification rejected");
        state.activeThread("thread");state.activeThread("");
        check(!state.allowed(avatar,"self"),"visit then leave resurrected a delayed notification");
        ChatReadState.Token pending=state.reserve("self","pending-read","thread",at);
        state.read("thread","pending-read",at,Arrays.asList("pending-read"));
        check(!state.allowed(pending,"self"),"read notification remained sendable");
        check(state.reserve("self","hydrated-old","thread","2026-01-01T00:00:00Z")==null,"older hydrated message notified");
        ChatReadState.Token next=state.reserve("self","next","thread","2026-01-03T00:00:00Z");
        ChatReadState.Token equal=state.reserve("self","equal","thread",at);
        state.read("thread","pending-read",at,Arrays.asList("pending-read"));
        check(state.allowed(next,"self")&&state.allowed(equal,"self"),"read discarded genuine next/equal-time messages");
        state.read("thread","out-of-order","2026-01-01T00:00:00Z",Collections.emptyList());
        check(state.isRead("other-old","thread","2026-01-01T12:00:00Z"),"older acknowledgement rewound read watermark");
        check(state.reserve("self","next","thread",at)==null,"duplicate notification allowed");
        state.activeThread("other-thread");check(state.allowed(next,"self"),"unrelated chat visit cancelled pending notification");
        state.owner("other-account");check(!state.allowed(next,"other-account"),"previous-account callback leaked");
        check(state.reserve("other-account","next","thread",at)!=null,"read state leaked into another account");
        System.out.println("PASS: Android delayed-avatar visit/read cancellation, late hydration, genuine/equal-time new messages, out-of-order read, deduplication and account isolation");
    }
}
