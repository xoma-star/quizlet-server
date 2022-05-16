import { getDocs, collection } from 'firebase/firestore'
import { firestore } from '../firebase'

const themes = [
    {id: 'history', name: 'История'},
    {id: 'math', name: 'Математика'},
    {id: 'english', name: 'Английский язык'},
    {id: 'geo', name: 'География'},
    {id: 'russian', name: 'Русский язык'},
    {id: 'tech', name: 'Технологии'}
]

const getThemes = async () => {
    // let themes: {id: string, name: string}[] = []
    // const docs = await getDocs(collection(firestore,'themes'))
    // docs.forEach(v => themes.push({id: v.id, name: v.data().name}))
    return themes
}

export default getThemes