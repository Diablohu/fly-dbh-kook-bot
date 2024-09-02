export const port = process.env.WEBPACK_BUILD_ENV === 'dev' ? 8081 : 8080;
export const newsChannelID = '6086801551312186';
export const cacheDir =
    process.env.WEBPACK_BUILD_ENV === 'dev' ? '.cache' : '/.cache';
export const logDir =
    process.env.WEBPACK_BUILD_ENV === 'dev' ? '.logs' : '/.logs';

/**
 * Discord 频道 ID -> Kook 频道 ID
 */
export const channelMapDiscordToKook: Record<string, string> =
    process.env.WEBPACK_BUILD_ENV === 'dev'
        ? {
              '1057919252922892298': '6086801551312186', // playground channel -> playground channel
              '1061924579100078090': '6086801551312186', // local dev channel -> playground channel
          }
        : {
              '1057919252922892298': '6086801551312186', // playground channel -> playground channel

              // MSFS
              '983629937451892766': '6218098845719397', // fs news channel 1
              '1058110232972247103': '6218098845719397', // fs news channel 2
              '1097849730731626578': '6218098845719397', // fs news channel 3
              '1060032674988826664': '6218098845719397', // fs news manual sync
              '1061038884143763538': '9294847620576543', // fs group

              // Other Games
              '1059769292717039626': '5037270702167031', // imas news channel
              '1069820588538986536': '4872647462994083', // kancolle news channel

              // Other Topics
              '1280002286046674974': '4754713495587085', // VT
          };
