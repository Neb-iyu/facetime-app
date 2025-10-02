import {User, Call, UserStatusMessage, WebSocketMessage, WSMessage} from "@/app/types/index"
import { use } from "react";
class WebSocketClient{
    private ws : WebSocket;
    private wsUrl = ''
    private statusListeners: ((status: UserStatusMessage) => void)[] = []
    private presenceListeners: ((status: UserStatusMessage) => void)[] = []
    private userListListeners: ((users: UserStatusMessage[]) => void)[] = []
    private usersStatus: Map<number, "online" | "offline" | "busy"> = new Map() 
    constructor(){
        this.ws = new WebSocket(this.wsUrl)
    }

    setupEventListener() {
        this.ws.addEventListener("message", (e) => {
            const message = JSON.parse(e.data)
            this.handleMessage(message)
        })
    }

    sendMessage(type: WSMessage, payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message: WebSocketMessage = {
                type,
                payload,
                time: new Date().toISOString()
            };
            this.ws.send(JSON.stringify(message));
        }
    }
    handleMessage(message: any) {
        switch (message.type) {
            case "user_online":
            case "user_offline":
                this.handleUserStatus(message);
            case "status":
                this.handleUserList(message);
            default:

        }
    }

    handleUserStatus(message: any) {
        const userStatus = message.payload as UserStatusMessage
        this.usersStatus.set(userStatus.userID, userStatus.status)
        this.presenceListeners.forEach(listener => listener(userStatus))
        console.log("User " + userStatus.userID + " is " + userStatus.status)
    }

    handleUserList(message: any) {
        const users = message.payload as UserStatusMessage[]
        users.forEach(user => {
            this.usersStatus.set(user.userID, user.status)
        })
        this.userListListeners.forEach(listener => listener(users))
        console.log("Recieved " + users.length + " amount of users")
    }

    addStatusListener(listener: (status: UserStatusMessage) => void) {
        this.statusListeners.push(listener);
    }

    addPresenceListener(listener: (status: UserStatusMessage) => void) {
        this.presenceListeners.push(listener)
    }

    addUserListListener(listener: (users: UserStatusMessage[]) => void) {
        this.userListListeners.push(listener)
    }
    
}

export const webSocketClient = new WebSocketClient()