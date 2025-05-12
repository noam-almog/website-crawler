
export function pathFor(url){
    const path = new URL(url).pathname
    const arr = path.split('/')
    const filePattern = /.*\.(html?|php|json|asp|htm|xml)$/i;
    if (arr.length > 0 && arr.at(-1).match(filePattern)) {
        arr.pop()
        return arr.join('/')
    }
    return path;
}
