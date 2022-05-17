import {Socket} from 'socket.io'
import {firestore} from "./firebase";
import {doc, getDoc, updateDoc} from 'firebase/firestore'
import sleep from "./functions/sleep";

export interface VKClient{
    vkid: string,
    socket: Socket
}

interface IQ{
    id: string,
    themes: string[]
}

interface queues {
    oneVSall: {[k: string]: string[]},
    oneVSone: {[k: string]: string[]},
    teamVSteam: {[k: string]: string[]},
    teamVSall: {[k: string]: string[]},
    one: {[k: string]: string[]}
}

interface playerInRoom{
    name?: string,
    ava?: string,
    score?: number,
    id: string
}

interface room{
    id: string,
    players: playerInRoom[],
    questions: any[],
    theme: string,
    mode: string
}

export class VKClients{
    clients: VKClient[] = []
    queues: queues = {
        oneVSall: {},
        oneVSone: {},
        teamVSteam: {},
        teamVSall: {},
        one: {}
    }
    rooms: room[] = []

    addClient(client: VKClient){
        this.clients.push(client)
    }

    removeClient(client: Socket){
        const socketID = client.id
        const vkid = this.clients.find(x => x.socket.id === socketID)?.vkid

        let i = 0
        while(i < this.clients.length){
            if(this.clients[i].vkid === vkid) {
                this.clients[i].socket.disconnect()
                this.clients.splice(i, 1)
            }
            else ++i
        }
    }

    sendToClient(id: string, message: string, data?: any){
        this.clients.forEach(x => {
            if(x.vkid === id) x.socket.emit(message, {...data})
        })
    }

    getVKID(id: string){
        const v = this.clients.find(x => x.socket.id === id)?.vkid
        if(typeof v === 'undefined') return '1'
        return v
    }

    async getPreferredThemes(id: string) {
        const vkid = this.getVKID(id)
        const ref = doc(firestore, 'users', vkid)
        const snap = await getDoc(ref)
        return snap?.data()?.preferredThemes
    }

    removeFromQueue(id: string){
        Object.keys(this.queues).forEach(v => {
            //@ts-ignore
            Object.keys(this.queues[v]).forEach(x => {
                //@ts-ignore
                this.queues[v][x] = this.queues[v][x].filter((x: string) => x !== id)
            })
        })
        console.log(this.queues)
    }

    updateRoomData(room: string, data: any){
        for(let i = 0; i < this.rooms.length; i++){
            if(this.rooms[i].id === room){
                this.rooms[i] = {...this.rooms[i], ...data}
                return
            }
        }
    }

    broadcastRoom(room: string, message: string, data?: any){
        this.rooms.find(x => x.id === room)?.players.forEach(x => this.sendToClient(x.id, message, data))
    }

    async playRoom(room: room){
        for (const x of room.questions) {
            this.broadcastRoom(room.id, 'newQuestion', {question: x})
            await sleep(x.time * 1000)
        }
    }

    async addUserDataToRoom(data: {id: string, name: string, ava: string, room: string}, callback: () => void){
        let r = this.rooms.findIndex(x => x.id === data.room)
        let a: playerInRoom = {id: data.id, name: data.name, ava: data.ava, score: 0}
        let b = this.rooms[r].players.findIndex(x => x.id === data.id)
        this.rooms[r].players[b] = a
        callback()
        this.broadcastRoom(this.rooms[r].id, 'updatedRoomData', this.rooms[r])
        if(!this.rooms[r].players.every((x) => typeof x.ava === 'undefined')) {
            this.broadcastRoom(this.rooms[r].id, 'roomReady')
            setTimeout(() => this.playRoom(this.rooms[r]), 5000)
        }
    }

    createRoom(players: string[], theme: string, mode: string){
        const roomID = Date.now().toString() + players[0]
        this.rooms.push({
            id: roomID,
            players: players.map(v => {return {id: v}}),
            questions: [{
                type: 'select',
                text: 'Гнидой был Ленин. А кто еще был пидором?',
                time: 10,
                answers: [
                    {text: 'Пыня', right: true},
                    {text: 'Сталин', right: false},
                    {text: 'Пушник', right: false},
                    {text: 'GAME_SEARCH', right: false}
                ]
            },
                {
                    type: 'select',
                    text: 'Гнидой был Ленин. А кто еще был пидором?',
                    time: 10,
                    answers: [
                        {text: 'Пыня', right: true},
                        {text: 'Сталин', right: false},
                        {text: 'Пушник', right: false},
                        {text: 'GAME_SEARCH', right: false}
                    ]
                }],
            theme: theme,
            mode: mode
        })
        return roomID
    }

    checkQueue(){

    }

    async insertQueue(data: {modesSelected: ('oneVSone' | 'oneVSall' | 'teamVSall' | 'teamVSteam' | 'one')[], themesSelected: string[]}, callback: () => void, id: string){
        const vkid = this.getVKID(id)
        try{
            data.modesSelected.forEach(v => {
                data.themesSelected.forEach(x => {
                    if(typeof this.queues[v][x] === 'undefined') this.queues[v][x] = []
                    this.queues[v][x].push(vkid)
                    switch (v){
                        case "one":
                            const room = this.createRoom(this.queues[v][x], x, v)
                            this.queues[v][x].forEach(z => {
                                setTimeout(() => this.sendToClient(z, 'foundGame', {room: room}), 1000)
                                this.removeFromQueue(z)
                            })
                            throw {}
                        case "oneVSall":
                            if(this.queues[v][x].length === 5){
                                this.queues[v][x].forEach(z => this.sendToClient(z, 'foundGame'))
                                return
                            }
                            break
                        case "teamVSall":
                            break
                        case "oneVSone":
                            if(this.queues[v][x].length === 2){
                                const room = this.createRoom(this.queues[v][x], x, v)
                                this.queues[v][x].forEach(z => {
                                    setTimeout(() => this.sendToClient(z, 'foundGame', {room: room}), 1000)
                                    this.removeFromQueue(z)
                                })
                                throw {}
                            }
                            break
                        case "teamVSteam":
                            break
                    }
                })
            })
        }
        catch {}
        await updateDoc(doc(firestore, 'users', this.getVKID(id)), {preferredThemes: data.themesSelected})
        callback()
    }
}