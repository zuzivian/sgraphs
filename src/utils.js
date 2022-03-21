

export function computeLabels(fields, records) {
    let temp_x, temp_y, temp_series = null;

    // choose default yKey
    for (let item in fields) {
        let field_name = fields[item].id;
        let sample_data = records[0][field_name];
        if (field_name === '_id' || field_name.includes('year') || field_name.includes('month')) continue;
        if ((!temp_y && isFloatOrInt(sample_data)) || field_name.includes('value') || field_name.includes('amt') || field_name.includes('amount')) {
            temp_y = field_name;
        }
    }
    if (!temp_y) temp_y = fields[1].id;
    // choose default xKey
    for (let item in fields) {
        let field_name = fields[item].id;
        let sample_data = records[0][field_name];
        if (field_name === '_id' || field_name === temp_y) continue;
        if ((!temp_x && isFloatOrInt(sample_data)) || field_name.includes('year') || field_name.includes('month')) {
            temp_x = field_name;
        }
    }
    if (!temp_x || temp_x === temp_y) temp_x = fields[1].id;
    if (temp_x === temp_y) temp_x = fields[2].id;
    // choose default series
    for (let item in fields) {
        let field_name = fields[item].id;
        let new_unique = records.reduce((prev, next) => prev.add(next[field_name]), new Set());
        let old_unique = records.reduce((prev, next) => prev.add(next[temp_series]), new Set());
        if (field_name === '_id' || field_name === temp_y || field_name === temp_x) continue;
        if (new_unique.size < 20 && new_unique.size > 1 && (!temp_series || new_unique.size < old_unique.size)) {
            temp_series = field_name;
        }
    }

    return [temp_x, temp_y, temp_series];
}

export function filterResourceIDs(pkgs, org) {
    return [...new Set(pkgs.filter(item => (item.organisation === org)).map(item => item.resource_id))];
}

export function getResourceNamefromID(packages, resID) {
    let resource = Object.values(packages.filter(item => item.resource_id === resID))[0];
    if (!resource) return '';
    return resource.resource_name;
}

export function isFloatOrInt(val) {
    return /^-?\d*(\.\d+)?$/.test(val);
}

export function parseFloatOrText(value) {
    let int = parseFloat(value);
    return isNaN(int) ? value : int;
}