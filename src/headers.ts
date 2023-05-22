function getDefaultHeaders() {
    return {
        Authorization: `Bot ${process.env.KOOK_TOKEN as string}`,
        'Content-Type': 'application/json',
    };
}

export default getDefaultHeaders;
