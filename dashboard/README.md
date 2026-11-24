# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## StudentVUE browser companion

Enable Grades under Settings > Tabs. The Grades tab can send legacy sign-in
requests from the browser directly to FCPS. Open a course to view its
assignments, edit points, or add a hypothetical assignment. Enable Grade graph
under Settings > Tabs to see the estimated trend in each course. Grades
refresh every five minutes while the tab is visible. It keeps
credentials in page memory until you disconnect, sign out, reload, or close
the page. Firefox or another browser can save them in its password manager.

Current-year StudentVUE course names are added to Classes for assignment
capture. Course scores, assignment grades, and projections stay in memory.

FCPS plans to remove legacy sign-in in December 2026.

The optional Chrome and Edge companion reads the visible FCPS StudentVUE Grade
Book overview. Sign in on FCPS's own site and open Grade Book. With
one Grade Book tab open, choose **read grade book** in Workflow. Reload Grade
Book before reading again if you need newer marks. FCPS controls when you need
to sign in again. The companion reads only the Grade Book page. Workflow uses
a 15-minute in-memory cache.

Production builds package the companion as a downloadable zip. For local
development, copy `studentvue-extension` to a temporary directory and add
`http://localhost/app` to `externally_connectable.matches` in the copied manifest.
Load the copy on the Chrome or Edge extensions page using **Load unpacked**.
The worker accepts local messages from `http://localhost:3000/app`. Once the
extension loads, reload any existing Workflow and Grade Book tabs.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
