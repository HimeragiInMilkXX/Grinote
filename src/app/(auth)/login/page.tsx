import LoginForm from "@/components/auth/login-form"
import { redirectIfAuthenticated } from "@/utils/redirectIfAuthenticated"

const LoginPage = async () => {

    await redirectIfAuthenticated();

    return (
        <LoginForm/>
    )
}

export default LoginPage
