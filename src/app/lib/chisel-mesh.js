export function cncChiselOptions(headType) {
    if (headType !== 'cnc') {
        return {};
    }
    return {
        chiselStl: true
    };
}
