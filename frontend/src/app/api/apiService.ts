import { User, Call } from '@/app/types/index';


class ApiService {
    private API_ENDPOINT = '';

    constructor() {
    }

    async getUser(id: string): Promise<User | undefined> {
        try {
            const response = await fetch(this.API_ENDPOINT + '/users/' + id);
            const data = await response.json();
            const user: User = typeof data === 'string' ? JSON.parse(data) : data;
            console.log(user);
            return user;
        } catch (error) {
            console.error('Error:', error);
            return undefined;
        }
    }

    async addUser(user: User) {
        const res = fetch(this.API_ENDPOINT + '/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({user})
        })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.error("Error", error));
    }


    async updateUser(user: User) {
        const res = fetch(this.API_ENDPOINT + '/users' + user.id, {
            method: 'PUT', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({user})
        })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.error('Error', error));
    }

    async getContacts(id: string) {
        try {
            const response = await fetch(this.API_ENDPOINT + '/users' + id + 'contacts');
            const data = await response.json();
            const contacts: User[] = typeof data === 'string' ? JSON.parse(data) : data;
            return contacts;
        }
        catch(error) {
            console.log('Error:', error);
            return [];
        }
    }

    async addContact(userId: string, contactId: string) {
        const contact = [userId, contactId]
        const res = fetch(this.API_ENDPOINT + '/contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({contact})
        })
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.error('Error:', error));
    }

    async addHistory(call: Call) {
        const res = fetch(this.API_ENDPOINT + "history", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({call})
        })
        .then(response=>response.json())
        .then(data => console.log(data))
        .catch(error => console.error('Error', error));
    }

    async getUserHistory(userId: string): Promise<Call[] | undefined> {
        try {
            const res = await fetch(this.API_ENDPOINT + 'users/' + userId + '/history');
            const data = await res.json();
            const history: Call[] = typeof data ==='string'? JSON.parse(data): data;
            return history;
        }
        catch(error) {
            console.error(error);
            return undefined;
        }
    }

    async getHistory(id: string): Promise<Call | undefined> {
        try {
            const res = await fetch(this.API_ENDPOINT + 'history' + id);
            const data = await res.json();
            const history: Call = typeof data ==='string'? JSON.parse(data): data;
            return history;
        }
        catch(error) {
            console.error(error);
            return undefined;
        }
    }
}

export const apiService = new ApiService();