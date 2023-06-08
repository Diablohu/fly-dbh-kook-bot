import axios, { AxiosError } from 'axios';
import numeral from 'numeral';

import type { CardMessageType, ModuleType } from '../../types';

import log, { logError } from '../logger';
import upload from '../upload';
import { registerCommand } from './';

interface OFP {
    fetch: {
        userid: string;
        static_id: Record<string, unknown>;
        status: 'Success';
        time: 'string;';
    };
    params: {
        request_id: string;
        user_id: string;
        time_generated: string;
        static_id: Record<string, unknown>;
        ofp_layout: 'LIDO';
        airac: string;
        units: 'kgs' | 'lbs';
    };
    general: {
        release: string;
        icao_airline: Record<string, unknown>;
        flight_number: string;
        is_etops: '0' | '1';
        dx_rmk: string;
        sys_rmk: Record<string, unknown>;
        is_detailed_profile: '0' | '1';
        cruise_profile: string;
        climb_profile: string;
        descent_profile: string;
        alternate_profile: string;
        reserve_profile: string;
        costindex: string;
        cont_rule: string;
        initial_altitude: string;
        stepclimb_string: string;
        avg_temp_dev: string;
        avg_tropopause: string;
        avg_wind_comp: string;
        avg_wind_dir: string;
        avg_wind_spd: string;
        gc_distance: string;
        route_distance: string;
        air_distance: string;
        total_burn: string;
        cruise_tas: string;
        cruise_mach: string;
        passengers: string;
        route: string;
        route_ifps: string;
        route_navigraph: string;
    };
    origin: {
        name: string;
        icao_code: string;
        iata_code: string;
        plan_rwy: string;
    };
    destination: {
        name: string;
        icao_code: string;
        iata_code: string;
        plan_rwy: string;
    };
    alternate: {
        name: string;
        icao_code: string;
        iata_code: string;
        plan_rwy: string;
    };
    aircraft: {
        icaocode: string;
        iatacode: Record<string, unknown>;
        base_type: string;
        icao_code: string;
        iata_code: Record<string, unknown>;
        name: string;
        reg: string;
        fin: Record<string, unknown>;
        selcal: Record<string, unknown>;
        equip: string;
        fuelfact: string;
        fuelfactor: string;
        max_passengers: string;
        internal_id: string;
        is_custom: string;
    };
    times: {
        est_time_enroute: string;
        sched_time_enroute: string;
        sched_out: string;
        sched_off: string;
        sched_on: string;
        sched_in: string;
        sched_block: string;
        est_out: string;
        est_off: string;
        est_on: string;
        est_in: string;
        est_block: string;
        orig_timezone: string;
        dest_timezone: string;
        taxi_out: string;
        taxi_in: string;
        reserve_time: string;
        endurance: string;
        contfuel_time: string;
        etopsfuel_time: string;
        extrafuel_time: string;
    };

    fuel: {
        taxi: string;
        enroute_burn: string;
        contingency: string;
        alternate_burn: string;
        reserve: string;
        etops: string;
        extra: string;
        min_takeoff: string;
        plan_takeoff: string;
        plan_ramp: string;
        plan_landing: string;
        avg_fuel_flow: string;
        max_tanks: string;
    };
    weights: {
        oew: string;
        pax_count: string;
        /** 平均乘客重 */
        pax_weight: string;
        payload: string;
        cargo: string;
        est_zfw: string;
        est_tow: string;
        est_ldw: string;
    };
    fms_downloads: {
        directory: string;
        [key: string]:
            | {
                  name: string;
                  link: string;
              }
            | string;
    };
    images: {
        directory: string;
        map: { name: string; link: string }[];
    };
    prefile: Record<
        string,
        {
            name: string;
            site: string;
            link: string;
            form: string;
        }
    >;
}

// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function commandFunction(
    query: string[]
): Promise<string | CardMessageType> {
    const qStr = query[0];
    if (typeof qStr !== 'string' || qStr.length < 3) {
        return `> 🤓 请输入正确的 SimBrief 用户名或用户ID`;
        // throw new Error('Wrong ICAO');
    }

    // const res = await axios
    //     .get(
    //         `https://avwx.rest/api/metar/${qStr.toUpperCase()}?options=&airport=true&reporting=true&format=json&remove=&filter=sanitized&onfail=cache`
    //     )
    //     .catch((err) => {
    //         // console.error(err);
    //         logError(err);
    //         return err;
    //     });
    const params: {
        json: 0 | 1;
        userid?: string;
        username?: string;
    } = {
        json: 1,
    };
    if (/^\d+$/.test(qStr)) params.userid = qStr;
    else params.username = qStr;

    const res = await axios
        .get<OFP>(
            `https://www.simbrief.com/api/xml.fetcher.php?${Object.entries(
                params
            )
                .map(([key, value]) => `${key}=${value}`)
                .join('&')}`
        )
        .then((res) => {
            log.http(res);
            return res;
        })
        .catch((err) => {
            logError(err);
            return err;
        });

    if (res instanceof AxiosError) {
        return `> 😣 查询失败 \`${
            res?.response?.data?.fetch?.status || res.message
        }\``;
    }
    if (!res) return `> 😣 查询失败`;

    const ofp: OFP = res.data;

    const W = ofp.params.units === 'kgs' ? 'kg' : 'lbs';
    const initialClimbAlt = Number(ofp.general.initial_altitude);
    const cruiseAlt =
        typeof ofp.general.stepclimb_string === 'string' &&
        !!ofp.general.stepclimb_string
            ? ofp.general.stepclimb_string
                  .split('/')
                  .filter((str) => /^\d+$/.test(str))
                  .map((str) => Number(str) * 100)
                  .sort((a, b) => b - a)[0]
            : initialClimbAlt;

    const postCard: CardMessageType = {
        type: 'card',
        theme: 'secondary',
        size: 'lg',
        modules: [
            {
                type: 'header',
                text: {
                    type: 'plain-text',
                    content: `${ofp.origin.name} ➡ ${ofp.destination.name}`,
                },
            },
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'paragraph',
                    cols: 3,
                    fields: [
                        {
                            type: 'kmarkdown',
                            content: `**🛫 始发地**\n　  ${ofp.origin.icao_code} / ${ofp.origin.iata_code}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**🛬 目的地**\n　  ${ofp.destination.icao_code} / ${ofp.destination.iata_code}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**🪂 备降**\n　  ${ofp.alternate.icao_code} / ${ofp.alternate.iata_code}`,
                        },
                    ],
                },
            },
            {
                type: 'section',
                text: {
                    type: 'paragraph',
                    cols: 3,
                    fields: [
                        {
                            type: 'kmarkdown',
                            content: `**✈ 机型** \`${ofp.aircraft.icao_code}\`\n　  ${ofp.aircraft.name}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**🗺 航线总长**\n　  ${numeral(
                                ofp.general.route_distance
                            ).format('0,0')} nm`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**⌚ 预计飞行时间**\n　  ${numeral(
                                ofp.times.est_time_enroute
                            )
                                .format('00:00:00')
                                .split(':')
                                .slice(0, 2)
                                .map((n) => numeral(n).format('00'))
                                .join(':')}`,
                        },
                    ],
                },
            },
            {
                type: 'section',
                text: {
                    type: 'kmarkdown',
                    content: `\`\`\`\n${ofp.origin.icao_code}/${ofp.origin.plan_rwy}\n${ofp.general.route}\n${ofp.destination.icao_code}/${ofp.destination.plan_rwy}\`\`\``,
                },
            },
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'paragraph',
                    cols: 2,
                    fields: [
                        {
                            type: 'kmarkdown',
                            content: `**初始爬升高度**\n> ${initialClimbAlt} ft`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计巡航高度**\n> ${cruiseAlt} ft`,
                        },
                    ],
                },
            },

            cruiseAlt !== initialClimbAlt
                ? {
                      type: 'section',
                      text: {
                          type: 'paragraph',
                          cols: 2,
                          fields: [
                              {
                                  type: 'kmarkdown',
                                  content: `**阶段式爬升**\n> \`${ofp.general.stepclimb_string}\``,
                              },
                          ],
                      },
                  }
                : undefined,

            {
                type: 'section',
                text: {
                    type: 'paragraph',
                    cols: 2,
                    fields: [
                        {
                            type: 'kmarkdown',
                            content: `**巡航速度**\n> ${ofp.general.cruise_tas} KTAS / M${ofp.general.cruise_mach}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**成本指数 (若适用)**\n> ${ofp.general.costindex}`,
                        },
                    ],
                },
            },
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'paragraph',
                    cols: 2,
                    fields: [
                        {
                            type: 'kmarkdown',
                            content: `**预计零油重量 (ZFW)**\n> ${numeral(
                                ofp.weights.est_zfw
                            ).format('0,0')} ${W}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计起飞重量 (TOW)**\n> ${numeral(
                                ofp.weights.est_tow
                            ).format('0,0')} ${W}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计乘客数 × 平均体重**\n> ${
                                ofp.weights.pax_count
                            } × ${numeral(ofp.weights.pax_weight).format(
                                '0.000'
                            )} ${W}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计货重 (含所有行李)**\n> ${numeral(
                                ofp.weights.cargo
                            ).format('0,0')} ${W}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计总载荷**\n> ${numeral(
                                ofp.weights.payload
                            ).format('0,0')} ${W}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计着陆重量**\n> ${numeral(
                                ofp.weights.est_ldw
                            ).format('0,0')} ${W}`,
                        },
                    ],
                },
            },
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'paragraph',
                    cols: 3,
                    fields: [
                        {
                            type: 'kmarkdown',
                            content: `**初始燃油量**\n> ${numeral(
                                ofp.fuel.plan_ramp
                            ).format('0,0')} ${W}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计着陆剩余燃油量**\n> ${numeral(
                                ofp.fuel.plan_landing
                            ).format('0,0')} ${W}`,
                        },
                        {
                            type: 'kmarkdown',
                            content: `**预计储备燃油量**\n> ${numeral(
                                ofp.fuel.reserve
                            ).format('0,0')} ${W}`,
                        },
                    ],
                },
            },
            {
                type: 'divider',
            },
            {
                type: 'container',
                elements: [
                    {
                        type: 'image',
                        src: await upload(
                            ofp.images.directory + ofp.images.map[0].link
                        ),
                    },
                ],
            },
            {
                type: 'action-group',
                elements: [
                    {
                        type: 'button',
                        theme: 'primary',
                        click: 'link',
                        value:
                            ofp.fms_downloads.directory +
                            ofp.fms_downloads.mfs.link,
                        text: {
                            type: 'plain-text',
                            content: '下载飞行计划文件',
                        },
                    },
                    {
                        type: 'button',
                        theme: 'info',
                        click: 'link',
                        value: ofp.prefile.vatsim.link,
                        text: {
                            type: 'plain-text',
                            content: '提交飞行计划至 VATSIM',
                        },
                    },
                ],
            },
            {
                type: 'divider',
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'plain-text',
                        content: '该飞行计划由 SimBrief 生成',
                    },
                ],
            },
        ].filter((v) => !!v) as ModuleType[],
    };

    return postCard;
}

// ============================================================================

registerCommand('simbrief', commandFunction, {
    command: 'simbrief',
    description: '查询目标用户在 SimBrief 最近签派的飞行计划',
    arguments: ['<用户名或用户ID>'],
    examples: ['/simbrief diablohu', '/simbrief 392663'],
});
registerCommand('sb', commandFunction);
