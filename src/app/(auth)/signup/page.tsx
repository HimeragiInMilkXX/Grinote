import SignupForm from "@/components/auth/signup-form";
import { redirectIfAuthenticated } from "@/utils/redirectIfAuthenticated"

const SignupPage = async () => {

    await redirectIfAuthenticated();

    return (
        <SignupForm/>
    )
}

export default SignupPage
