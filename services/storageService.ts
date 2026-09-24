import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '../lib/firebase';

/**
 * Uploads a thumbnail image to Firebase Storage under the path:
 *   videos/{videoId}/thumbnail.{extension}
 * Returns the public download URL.
 */
export async function uploadThumbnail(videoId: string, file: File): Promise<string> {
  if (!app) throw new Error('Firebase app not initialized');
  const storage = getStorage(app);
  const extension = file.name.split('.').pop() ?? 'png';
  const storageRef = ref(storage, `videos/${videoId}/thumbnail.${extension}`);
  const uploadTask = uploadBytesResumable(storageRef, file);
  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      () => {},
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}
