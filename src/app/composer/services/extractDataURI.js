import { flow, map, filter } from 'lodash/fp';

import { MIME_TYPES } from '../../constants';

const { PLAINTEXT } = MIME_TYPES;

/* @ngInject */
function extractDataURI(attachmentModel, embedded) {
    /**
     * Convert data-uri to blob
     * @param {String} dataURI
     * @return {Blob}
     */
    function dataURItoBlob(dataURI = '') {
        const [mime = '', byte = ''] = dataURI.split(',');

        // separate out the mime component
        const mimeString = mime.split(':')[1].split(';')[0];
        // write the bytes of the string to an ArrayBuffer
        const data = openpgp.util.b64_to_Uint8Array(byte);

        // write the ArrayBuffer to a blob, and you're done
        return new Blob([data], { type: mimeString });
    }

    /**
     * Transform every data-uri in the message content to embedded attachment
     * @param {Resource} message
     * @return {Promise}
     */
    async function extractDataURI(message) {
        if (message.MIMEType === PLAINTEXT) {
            return message;
        }

        const content = message.getDecryptedBody();
        const testDiv = document.createElement('DIV');

        testDiv.innerHTML = content;

        const images = testDiv.querySelectorAll('img');

        const promises = flow(
            filter(({ src }) => /data:image/.test(src)), // only data:uri image
            filter(({ src }) => src.includes(',')), // remove invalid data:uri
            map((image) => {
                const cid = embedded.generateCid(image.src, message.From.Email);
                const setEmbeddedImg = () => {
                    image.setAttribute('data-embedded-img', cid);

                    return Promise.resolve();
                };

                if (embedded.exist(message, cid)) {
                    return setEmbeddedImg();
                }

                const file = dataURItoBlob(image.src);

                file.name = image.alt || 'image' + Date.now();
                file.inline = 1;

                return attachmentModel.create(file, message, true, cid).then(setEmbeddedImg);
            })
        )([].slice.call(images));

        await Promise.all(promises);

        message.setDecryptedBody(testDiv.innerHTML);
        return message;
    }

    return extractDataURI;
}
export default extractDataURI;
