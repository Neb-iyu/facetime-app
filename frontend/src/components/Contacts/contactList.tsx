import { User } from "@/types/index";
import { apiService } from "@/api/apiService";
import React, { useState, useEffect } from "react";
import ContactItem from "./contactItem";
import { wsClient } from "@/api/webSocketClient";

interface Contacts<User> {
    items: User[];

}
let id = ''
const contactList: React.FC = () => {
    const [contacts, setContacts] = useState<User[]>([]);
    const [statuses, setStatuses] = useState<Map<number, "online" | "offline" | "busy">>(new Map());

    useEffect(() => {
        const fetchContacts = async () => {
            setContacts(await apiService.getContacts(id));
        };
        fetchContacts();
        
        wsClient.addPresenceListener((status) => {
        setStatuses((prevMap) => new Map(prevMap.set(status.userID, status.status)))
    })
    }, [])

    
    return (
        <ul>
            {contacts.map(contact => (
                <li>
                    <ContactItem contact={{...contact, status: statuses.get(contact.id) || contact.status}} />
                </li>
            ))}
        </ul>
    )
}



export default function ContactList() {
    return (
        <ul>

        </ul>
    )
}