import {Socket} from 'socket.io'
import {firestore} from "./firebase";
import {collection, doc, getDoc, getDocs, updateDoc} from 'firebase/firestore'
import sleep from "./functions/sleep";
import similarity from "./functions/similarity";

export interface VKClient{
    vkid: string,
    socket: Socket
}

enum possibleQueues {
    ONE_VS_ALL = 'oneVSall',
    ONE_VS_ONE = 'oneVSone',
    TEAM_VS_TEAM = 'teamVSteam',
    SOLO = 'one',
    TEAM_VS_TEAMS = 'teamVSall'
}

enum possibleThemes {
    'history',
    'english',
    'geo',
    'math',
    'russian',
    'tech'
}

interface Question{
    author?: string,
    image?: string,
    text: string,
    time: number,
    answeredRight: string[],
    answeredWrong: string[]
}

interface SelectAnswers{
    text: string,
    right?: boolean
}

interface QuestionSelect extends Question{
    type: 'select',
    answers: SelectAnswers[],
    usersAnswers: {id: string, answer: number}[]
}

interface QuestionEnter extends Question{
    type: 'enter',
    answer: string,
    usersAnswers: {id: string, answer: string}[]
}

type QuestionType = QuestionSelect | QuestionEnter

type queues = {
    [key in possibleQueues]: {[key in possibleThemes]?: string[]}
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
    questions: QuestionType[],
    theme: string,
    mode: string,
    activeQuestion: number
}

export class VKClients{
    clients: VKClient[] = []
    queues: queues = {
        [possibleQueues.SOLO]: {},
        [possibleQueues.ONE_VS_ALL]: {},
        [possibleQueues.ONE_VS_ONE]: {},
        [possibleQueues.TEAM_VS_TEAM]: {},
        [possibleQueues.TEAM_VS_TEAMS]: {}
    }
    rooms: room[] = []

    addClient(client: VKClient){
        this.clients.push(client)
    }

    removeClient(client: Socket){
        const socketID = client.id
        const vkid = this.clients.find(x => x.socket.id === socketID)?.vkid
        if(typeof vkid === 'undefined') return
        this.removeFromQueue(vkid)

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
        for(let v in this.queues){
            let x = v as keyof queues
            for(let z in this.queues[x]){
                let y = z as unknown as keyof queues[typeof x]
                this.queues[x][y] = this.queues[x][y]?.filter((u: string) => u !== id)
            }
        }
        // Object.entries(this.queues).forEach(([v, i]) => {
        //     Object.entries(this.queues[v]).forEach(x => {
        //         this.queues[v][x] = this.queues[v][x].filter((x: string) => x !== id)
        //     })
        // })
    }

    broadcastRoom(room: string, message: string, data?: any){
        this.rooms.find(x => x.id === room)?.players.forEach(x => this.sendToClient(x.id, message, data))
    }

    sendQuestion(question: QuestionType, room: string){
        let clientQuestion
        if(question.type === 'select') clientQuestion = {
            ...question,
            answers: question.answers.map(x => {return {text: x.text}})
        }
        if(question.type === 'enter') clientQuestion = {
            ...question,
            answer: ''
        }
        this.broadcastRoom(room, 'newQuestion', {question: clientQuestion})
    }

    async playRoom(room: room){
        for(let i = 0; i < room.questions.length; i++){
            let v = this.rooms.findIndex(x => x.id === room.id)
            this.rooms[v].activeQuestion = i
            this.sendQuestion(this.rooms[v].questions[i], room.id)
            // this.broadcastRoom(room.id, 'updatedRoomData', this.rooms[v])
            await sleep(room.questions[i].time * 1000 + 500)
        }
        this.broadcastRoom(room.id, 'updatedRoomData', this.rooms.find(x => x.id === room.id))
        this.removeRoom(room.id)
    }

    removeRoom(id: string) {
        let i = this.rooms.findIndex(x => x.id === id)
        this.rooms.splice(i, 1)
    }

    playerAnswered(data: {room: string, player: string, answer: string | number}){
        let i = this.rooms.findIndex(x => x.id === data.room)
        const k = this.rooms[i].activeQuestion
        let a = {...this.rooms[i].questions[k]}
        switch (a.type){
            case 'select':
                if(typeof data.answer !== 'number') return
                if(a.answers[data.answer].right) a.answeredRight.push(data.player)
                else a.answeredWrong.push(data.player)
                a.usersAnswers.push({id: data.player, answer: data.answer})
                break
            case 'enter':
                if(typeof data.answer !== 'string') return
                if(similarity(a.answer, String(data.answer)) > 0.7) a.answeredRight.push(data.player)
                else a.answeredWrong.push(data.player)
                a.usersAnswers.push({id: data.player, answer: data.answer})
                break
        }
        this.rooms[i].questions[k] = a
        this.sendQuestion(a, data.room)
    }

    async addUserDataToRoom(data: {id: string, name: string, ava: string, room: string}, callback: () => void){
        let r = this.rooms.findIndex(x => x.id === data.room)
        let a: playerInRoom = {id: data.id, name: data.name, ava: data.ava, score: 0}
        let b = this.rooms[r].players.findIndex(x => x.id === data.id)
        this.rooms[r].players[b] = a
        callback()
        this.broadcastRoom(this.rooms[r].id, 'updatedRoomData', {
            ...this.rooms[r],
            questions: []
        })
        if(this.rooms[r].players.every((x) => typeof x.ava !== 'undefined')) {
            this.broadcastRoom(this.rooms[r].id, 'roomReady')
            setTimeout(() => {this.playRoom(this.rooms[r])}, 5000)
        }
    }

    async createRoom(players: string[], theme: possibleThemes, mode: possibleQueues){
        const roomID = Date.now().toString() + players[0]
        let th = theme as unknown as string
        this.rooms.push({
            activeQuestion: -1,
            id: roomID,
            players: players.map(v => {return {id: v}}),
            questions: (await getDocs(collection(firestore, 'themes', th, 'questions'))).docs.
            map(x => { return {...x.data() as QuestionType, usersAnswers: [], answeredRight: [], answeredWrong: []}}),
            theme: th,
            mode: mode
        })
        return roomID
    }

    async insertQueue(data: {modesSelected: possibleQueues[], themesSelected: possibleThemes[]}, callback: () => void, id: string){
        const vkid = this.getVKID(id)
        try{
            data.modesSelected.forEach(v => {
                data.themesSelected.forEach(x => {
                    if(typeof this.queues[v][x] === 'undefined') this.queues[v][x] = []
                    this.queues[v][x]?.push(vkid)
                    switch (v){
                        case "one": throw {v: v, x: x}
                        case "oneVSall": if(this.queues[v][x]?.length === 5) throw {v: v, x: x}
                            break
                        case "teamVSall": break
                        case "oneVSone": if(this.queues[v][x]?.length === 2)throw {v: v, x: x}
                            break
                        case "teamVSteam":
                            break
                    }
                })
            })
        }
        catch(e: any) {
            if(e.v && e.x){
                let a: {v: possibleQueues, x: possibleThemes} = {v: e.v, x: e.x}
                let b = this.queues[a.v][a.x] as string[]
                this.createRoom(b, a.x, a.v).then(room => {
                    this.queues[a.v][a.x]?.forEach(z => {
                        setTimeout(() => this.sendToClient(z, 'foundGame', {room: room}), 1000)
                        this.removeFromQueue(z)
                    })
                })
            }
        }
        await updateDoc(doc(firestore, 'users', this.getVKID(id)), {preferredThemes: data.themesSelected})
        callback()
    }
}