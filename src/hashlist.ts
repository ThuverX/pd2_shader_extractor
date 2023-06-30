import Long from 'long'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { lookup8 } from './lookup8'

export namespace Hashlist {
    export const hashes: Map<Long, string> = new Map()
    export let loaded = false

    const hashlist_path = "./files/hashlist.txt"
    const hashlist_cache = "./files/hashlist.cache.db"

    const splitter = '🤔'

    function cache() {
        let outstring = ''

        for(let [hash, name] of hashes) {
            let line = '0x' + hash.toString(16) + splitter + name

            outstring += line + '\n'
        }

        writeFileSync(hashlist_cache, outstring)
    }

    function read_cache() {
        let file_data:string = readFileSync(hashlist_cache, 'utf-8')
        let lines = file_data.split('\n')

        hashes.clear()

        for(let line of lines) {
            let [hash, name] = line.split(splitter)

            if(hash.trim())
                hashes.set(Long.fromString(hash, true, 16), name)
        }
    }

    function exists_cache() {
        return existsSync(hashlist_cache)
    }

    function load(file_path?: string) {
        console.time('hashlist')
        if(exists_cache() && !file_path) {
            read_cache()
            loaded = true
            console.log('hashlist loaded from cache')
            console.timeEnd('hashlist')
            return
        }

        let file_data:string = readFileSync(file_path || hashlist_path, 'utf-8')
        let lines = file_data.split('\n')

        if(!file_path) hashes.clear()

        for(let line of lines) {
            let hash = lookup8.hash(line)

            hashes.set(hash, line)
        }

        loaded = true

        console.timeEnd('hashlist')

        cache()
    }

    export function mapGetByLong<T>(map: Map<Long, T>, key: Long): T | undefined {
        for(let [k, v] of map) {
            if(k.equals(key)) return v
        }
        return undefined
    }

    export function get(id: Long): string {
        if(!loaded) load()

        id = id.toUnsigned()

        return mapGetByLong(hashes, id) || ('0x' + id.toString(16))
    }

    export async function merge(file_path: string) {
        if(!loaded) load()
        load(file_path)
    }
}