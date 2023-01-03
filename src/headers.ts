function getDefaultHeaders() {
    return {
        Authorization: `Bot ${process.env.KOOK_TOKEN as string}`,
        'Content-type': 'application/json',
    };
}

export default getDefaultHeaders;
