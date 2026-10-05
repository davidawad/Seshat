import releaseData from 'virtual:seshat-releases'
import { ReleaseNotesView } from './ReleaseNotesView'

/** The Release notes route: the build-time data from the commit history, rendered by the view. */
export const ReleaseNotesPage = () => <ReleaseNotesView data={releaseData} />
