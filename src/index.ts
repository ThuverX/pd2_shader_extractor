import ByteBuffer from "bytebuffer";
import { ReadShaderPackage } from "./shaderPackage";
import { readFile } from 'fs/promises'
import { ExtractShaderPackage } from "./extractor";
import { Hashlist } from "./hashlist";

let file_path = process.argv[2]
let output_path = process.argv[3]
let decompile = process.argv[4] == 'true' || false
let threads = parseInt(process.argv[5] || "0") || 0

;(async () => {

    if(!file_path || !output_path) {
        console.log('Usage: yarn start <file_path> <output_path> <decompile>? <threads>?')
        return
    }

    Hashlist.merge('./files/render_templates_hashes.txt')

    const file = ByteBuffer.wrap(await readFile(file_path))

    const shader_package = ReadShaderPackage(file)
    
    await ExtractShaderPackage(shader_package, output_path, {
        decompile,
        threads
    })
})()