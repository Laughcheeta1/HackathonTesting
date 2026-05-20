function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value) {
    return typeof value === "string";
}

function isNumber(value) {
    return typeof value === "number";
}

function isNullableString(value) {
    return value === null || isString(value);
}

function isNullableNumber(value) {
    return value === null || isNumber(value);
}

function hasOptionalNullableString(obj, key) {
    return !(key in obj) || isNullableString(obj[key]);
}

function hasOptionalNullableNumber(obj, key) {
    return !(key in obj) || isNullableNumber(obj[key]);
}

function checkUploaderObject(obj) {
    return isObject(obj)
        && isNumber(obj.id)
        && isString(obj.display_name)
        && isNullableString(obj.avatar_url);
}

function hasOptionalUploader(obj) {
    return !("uploader" in obj)
        || obj.uploader === null
        || checkUploaderObject(obj.uploader);
}

function checkVideoObject(obj) {
    return isObject(obj)
        && isNumber(obj.id)
        && isString(obj.title)
        && isString(obj.description)
        && isString(obj.created_at)
        && isNumber(obj.views)
        && isString(obj.stream_url)
        && hasOptionalNullableString(obj, "thumbnail_url")
        && hasOptionalUploader(obj);
}

function checkUserObject(obj) {
    return isObject(obj)
        && isNumber(obj.id)
        && isString(obj.display_name)
        && isNullableString(obj.avatar_url)
        && isString(obj.created_at);
}

function checkCommentObject(obj) {
    return isObject(obj)
        && isNumber(obj.id)
        && isNumber(obj.video_id)
        && isString(obj.author)
        && isString(obj.content)
        && isString(obj.created_at);
}

function checkProvidersObject(obj) {
    return isObject(obj)
        && Array.isArray(obj.providers)
        && obj.providers.every(isString);
}

function checkSubscriptionsObject(obj) {
    return isObject(obj)
        && Array.isArray(obj.creator_ids)
        && obj.creator_ids.every(isNumber);
}

function checkAuthTokenObject(obj) {
    return isObject(obj)
        && isString(obj.access_token)
        && isString(obj.token_type)
        && isNumber(obj.expires_in);
}

function checkArrayResponse(obj, itemValidator) {
    return Array.isArray(obj) && obj.every(itemValidator);
}

function checkPaginatedResponse(obj, itemValidator) {
    return isObject(obj)
        && Array.isArray(obj.items)
        && obj.items.every(itemValidator)
        && isNumber(obj.limit)
        && isNumber(obj.offset)
        && isNumber(obj.page_count)
        && isNumber(obj.total_count)
        && isNullableNumber(obj.next_offset)
        && hasOptionalNullableNumber(obj, "count");
}

function checkVideoArrayResponse(obj, allowEmpty = false) {
    return Array.isArray(obj)
        && (allowEmpty || obj.length > 0)
        && obj.every(checkVideoObject);
}

function checkPaginatedVideoObjectResponse(obj, allowEmpty = false) {
    return checkPaginatedResponse(obj, checkVideoObject)
        && (allowEmpty || obj.items.length > 0);
}

function checkUserArrayResponse(obj) {
    return checkArrayResponse(obj, checkUserObject);
}

function checkPaginatedUserObjectResponse(obj) {
    return checkPaginatedResponse(obj, checkUserObject);
}

function checkCommentArrayResponse(obj) {
    return checkArrayResponse(obj, checkCommentObject);
}

function checkPaginatedCommentObjectResponse(obj) {
    return checkPaginatedResponse(obj, checkCommentObject);
}

function checkStatus(response, expectedStatus = 200) {
    const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    return Boolean(response && expected.includes(response.status));
}

function parseJson(response) {
    try {
        return response.json();
    } catch (error) {
        return null;
    }
}

export default {
    checkVideoObject,
    checkUserObject,
    checkCommentObject,
    checkProvidersObject,
    checkSubscriptionsObject,
    checkAuthTokenObject,
    checkVideoArrayResponse,
    checkPaginatedVideoObjectResponse,
    checkUserArrayResponse,
    checkPaginatedUserObjectResponse,
    checkCommentArrayResponse,
    checkPaginatedCommentObjectResponse,
};
