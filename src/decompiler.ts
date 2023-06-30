import ByteBuffer from "bytebuffer";
import { Info_GameShader } from "./extractor";
import { writeFile } from 'fs/promises'
import { exec } from 'child_process'

export const decompiler_path = "X:/pd2_shader_extractor/DXDecompiler/src/DXDecompilerCmd/bin/Debug/net5.0/DXDecompilerCmd.exe"

export function DecompileShader(bb: ByteBuffer, type: 'ps_3_0' | 'vs_3_0', index: number = 0): Promise<Info_GameShader> {
    return new Promise(async (res) => {

        const out_path = `./temp/shader_${ index }.o`

        await writeFile(out_path, bb.toBuffer())
    
        const command = `${decompiler_path} ${out_path}`

        exec(command, async (error, stdout, stderr) => {
            if(error) {
                res({
                    type,
                    code: bb,
                    status: 'raw',
                    error: stderr,
                    decompiler: 'DXDecompiler'
                })
            }

            res({
                type,
                code: stdout,
                status: 'decompiled',
                decompiler: 'DXDecompiler'
            })
        })
    })
}