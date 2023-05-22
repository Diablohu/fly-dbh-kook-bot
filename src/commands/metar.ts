import axios from 'axios';

async function commandMetar(icao: string): Promise<string> {
    if (typeof icao !== 'string' || icao.length !== 4) {
        return `错误的 ICAO 机场代码`;
        // throw new Error('Wrong ICAO');
    }

    // console.log({ icao });
    const result =
        (
            await axios.get(
                `https://metar.vatsim.net/metar.php?id=${icao.toLowerCase()}`
            )
        ).data || '';

    if (result === '') {
        return `查询 ${icao.toUpperCase()} 气象报文失败: 机场未找到`;
    }

    // return `**${icao.toUpperCase()}** 机场当前气象报文 (METAR)\n \`${result}\``;
    return `\`${result}\``;
}

export default commandMetar;
