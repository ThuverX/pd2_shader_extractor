import ByteBuffer from "bytebuffer";
import Long from "long";
import { Hashlist } from "./hashlist";

export namespace lookup8 {
    export function hash(value: string): Long {
        return lookup8(
            ByteBuffer.wrap(
                Buffer.from(value, 'utf-8')), Long.ZERO)
    }

    export function lookup(value: Long): string {
        return Hashlist.get(value)
    }

    interface LongTriple {
        a: Long,
        b: Long,
        c: Long
    }

    function mix(t: LongTriple) {
        let a = t.a
        let b = t.b
        let c = t.c

        a = a.subtract(b)
        a = a.subtract(c)
        a = a.xor(c.shiftRightUnsigned(43))

        b = b.subtract(c)
        b = b.subtract(a)
        b = b.xor(a.shiftLeft(9))

        c = c.subtract(a)
        c = c.subtract(b)
        c = c.xor(b.shiftRightUnsigned(8))

        a = a.subtract(b)
        a = a.subtract(c)
        a = a.xor(c.shiftRightUnsigned(38))

        b = b.subtract(c)
        b = b.subtract(a)
        b = b.xor(a.shiftLeft(23))

        c = c.subtract(a)
        c = c.subtract(b)
        c = c.xor(b.shiftRightUnsigned(5))

        a = a.subtract(b)
        a = a.subtract(c)
        a = a.xor(c.shiftRightUnsigned(35))

        b = b.subtract(c)
        b = b.subtract(a)
        b = b.xor(a.shiftLeft(49))

        c = c.subtract(a)
        c = c.subtract(b)
        c = c.xor(b.shiftRightUnsigned(11))

        a = a.subtract(b)
        a = a.subtract(c)
        a = a.xor(c.shiftRightUnsigned(12))

        b = b.subtract(c)
        b = b.subtract(a)
        b = b.xor(a.shiftLeft(18))

        c = c.subtract(a)
        c = c.subtract(b)
        c = c.xor(b.shiftRightUnsigned(22))

        t.a = a
        t.b = b
        t.c = c
    }

    export function lookup8(bb: ByteBuffer, level: Long): Long {
        bb.order(ByteBuffer.LITTLE_ENDIAN)

        const t: LongTriple = {
            a: level,
            b: level,
            c: Long.fromString("0x9e3779b97f4a7c13", true, 16),
        }

        while (bb.remaining() >= 24) {
            t.a = t.a.add(bb.readLong())
            t.b = t.b.add(bb.readLong())
            t.c = t.c.add(bb.readLong())

            mix(t)
        }

        t.c = t.c.add(bb.capacity())

        const rb = bb.slice()

        const get = (i: number) => Long.fromInt(rb.toBuffer()[i], true)

        switch (bb.remaining()) {
            case 23: t.c = t.c.add(get(22).shiftLeft(56))
            case 22: t.c = t.c.add(get(21).shiftLeft(48))
            case 21: t.c = t.c.add(get(20).shiftLeft(40))
            case 20: t.c = t.c.add(get(19).shiftLeft(32))
            case 19: t.c = t.c.add(get(18).shiftLeft(24))
            case 18: t.c = t.c.add(get(17).shiftLeft(16))
            case 17: t.c = t.c.add(get(16).shiftLeft(8))
            
            case 16: t.b = t.b.add(get(15).shiftLeft(56))
            case 15: t.b = t.b.add(get(14).shiftLeft(48))
            case 14: t.b = t.b.add(get(13).shiftLeft(40))
            case 13: t.b = t.b.add(get(12).shiftLeft(32))
            case 12: t.b = t.b.add(get(11).shiftLeft(24))
            case 11: t.b = t.b.add(get(10).shiftLeft(16))
            case 10: t.b = t.b.add(get(9).shiftLeft(8))
            case 9: t.b  = t.b.add(get(8))
            
            case 8: t.a  = t.a.add(get(7).shiftLeft(56))
            case 7: t.a  = t.a.add(get(6).shiftLeft(48))
            case 6: t.a  = t.a.add(get(5).shiftLeft(40))
            case 5: t.a  = t.a.add(get(4).shiftLeft(32))
            case 4: t.a  = t.a.add(get(3).shiftLeft(24))
            case 3: t.a  = t.a.add(get(2).shiftLeft(16))
            case 2: t.a  = t.a.add(get(1).shiftLeft(8))
            case 1: t.a  = t.a.add(get(0))
        }

        mix(t)

        return t.c
    }
}