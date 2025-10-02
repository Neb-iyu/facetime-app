import React, {useState, useEffect} from 'react';
import { User } from '@/app/types/index';
import { webSocketClient } from '@/app/api/webSocketClient';
import  Image from "next/image";

const iconUrl = '';
interface ContactItemProps {
    contact: User;
}

function contactItem({contact}: ContactItemProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    useEffect(() => {
        const fetchImage = async () => {
            const response = await fetch('');
            const blob = await response.blob();
            setImageUrl(URL.createObjectURL(blob));
        }
    })
    return (
        <div>
            {imageUrl && (
                <img src={imageUrl} />
            )}
            <div>
                <p>{contact.name}</p>
                <div>
                    {contact.status === "online" ? (
                        <img src={iconUrl + "online.ico"} />
                    ) : contact.status === "offline" ? (
                        <img src={iconUrl + "offline.ico"} />
                    ) : (
                        <img src={iconUrl + "busy.ico"} />
                    )}
                </div>
            </div>
        </div>
    )
}
export default contactItem;